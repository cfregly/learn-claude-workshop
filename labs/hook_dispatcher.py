#!/usr/bin/env python3
"""Synthetic Northstar dispatcher lab.

This file makes no API or CRM call. It is an application policy mock, not an
actual Claude hook payload, SDK callback, or provider wire fixture.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass
from time import sleep
from typing import FrozenSet, Optional


@dataclass(frozen=True)
class MockPolicy:
    required_write_scope: str = "northstar:write"
    runtime_environment: str = "training"
    before_check_timeout_seconds: float = 0.01
    timeout_effect: str = "deny"


@dataclass(frozen=True)
class Caller:
    caller_id: str
    authenticated: bool
    account_ids: FrozenSet[str]
    scopes: FrozenSet[str]


@dataclass(frozen=True)
class ToolRequest:
    account_id: str
    action: str
    new_stage: str
    expected_version: int
    model_claimed_approval: bool
    model_claimed_environment: str


@dataclass(frozen=True)
class Decision:
    status: str
    reason: str
    receipt: Optional[str] = None
    audit_status: str = "not_run"


class SyntheticNorthstarStore:
    def __init__(self) -> None:
        self.accounts = {
            "northstar": {
                "owner": "Maya Chen",
                "renewal_date": "2027-01-31",
                "stage": "draft",
                "version": 7,
            }
        }
        self.read_count = 0
        self.write_count = 0

    def read(self, account_id: str) -> dict:
        self.read_count += 1
        return dict(self.accounts[account_id])

    def commit_stage(self, account_id: str, new_stage: str) -> str:
        record = self.accounts[account_id]
        record["stage"] = new_stage
        record["version"] += 1
        self.write_count += 1
        return f"synthetic-receipt-{self.write_count:03d}"


class ApplicationDispatcher:
    def __init__(self, store: SyntheticNorthstarStore, policy: MockPolicy) -> None:
        self.store = store
        self.policy = policy
        self.allow_count = 0
        self.deny_count = 0

    def _before_execution_check(
        self,
        caller: Caller,
        request: ToolRequest,
        delay_seconds: float,
    ) -> Decision:
        if delay_seconds:
            sleep(delay_seconds)
        if not caller.authenticated:
            return Decision("denied", "caller_not_authenticated")
        if request.account_id not in caller.account_ids:
            return Decision("denied", "account_out_of_scope")
        if self.policy.required_write_scope not in caller.scopes:
            return Decision("denied", "missing_write_scope")
        if request.action != "set_renewal_stage":
            return Decision("denied", "unsupported_action")
        return Decision("allowed", "application_policy_passed")

    def _after_action_log(self, receipt: str, fail: bool) -> None:
        if fail:
            raise RuntimeError("synthetic audit sink unavailable")
        if not receipt.startswith("synthetic-receipt-"):
            raise ValueError("receipt required")

    def dispatch(
        self,
        caller: Caller,
        request: ToolRequest,
        *,
        before_delay_seconds: float = 0.0,
        fail_after_log: bool = False,
    ) -> Decision:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                self._before_execution_check,
                caller,
                request,
                before_delay_seconds,
            )
            try:
                decision = future.result(
                    timeout=self.policy.before_check_timeout_seconds
                )
            except FutureTimeout:
                future.cancel()
                self.deny_count += 1
                return Decision("denied", "app_before_check_timeout")

        if decision.status != "allowed":
            self.deny_count += 1
            return decision

        record = self.store.read(request.account_id)
        if record["version"] != request.expected_version:
            self.deny_count += 1
            return Decision("denied", "version_conflict")

        receipt = self.store.commit_stage(request.account_id, request.new_stage)
        self.allow_count += 1
        audit_status = "logged"
        try:
            self._after_action_log(receipt, fail_after_log)
        except RuntimeError:
            audit_status = "failed_after_commit"
        return Decision("allowed", "committed", receipt, audit_status)


def check(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)


def run_offline_checks() -> None:
    store = SyntheticNorthstarStore()
    policy = MockPolicy()
    dispatcher = ApplicationDispatcher(store, policy)
    request = ToolRequest(
        account_id="northstar",
        action="set_renewal_stage",
        new_stage="review_ready",
        expected_version=7,
        model_claimed_approval=True,
        model_claimed_environment="production",
    )

    authorized = Caller(
        "engineer-1",
        True,
        frozenset({"northstar"}),
        frozenset({"northstar:write"}),
    )
    allowed = dispatcher.dispatch(authorized, request, fail_after_log=True)
    check(allowed.status == "allowed", "authorized write should be allowed")
    check(allowed.receipt == "synthetic-receipt-001", "commit receipt missing")
    check(allowed.audit_status == "failed_after_commit", "after log evidence missing")
    check(store.write_count == 1, "write should commit exactly once")
    print(
        "PASS allow status=allowed receipt=synthetic-receipt-001 "
        "audit=failed_after_commit"
    )

    wrong_account = Caller(
        "engineer-2",
        True,
        frozenset({"other-account"}),
        frozenset({"northstar:write"}),
    )
    denied = dispatcher.dispatch(wrong_account, request)
    check(denied.reason == "account_out_of_scope", "account deny failed")
    check(denied.receipt is None, "denied action returned a receipt")
    check(store.read_count == 1 and store.write_count == 1, "deny touched data")
    print("PASS deny status=denied reason=account_out_of_scope receipt=None")

    forged_caller = Caller(
        "engineer-3",
        True,
        frozenset({"northstar"}),
        frozenset(),
    )
    forged = dispatcher.dispatch(forged_caller, request)
    check(forged.reason == "missing_write_scope", "forged approval bypassed scope")
    check(forged.receipt is None, "forged approval returned a receipt")
    check(store.read_count == 1 and store.write_count == 1, "forgery touched data")
    print("PASS forged status=denied reason=missing_write_scope receipt=None")

    timed_out = dispatcher.dispatch(
        authorized,
        request,
        before_delay_seconds=0.05,
    )
    check(timed_out.reason == "app_before_check_timeout", "timeout policy failed")
    check(timed_out.receipt is None, "timed out check returned a receipt")
    check(store.read_count == 1 and store.write_count == 1, "timeout touched data")
    print("PASS timeout status=denied reason=app_before_check_timeout receipt=None")

    check(dispatcher.allow_count == 1, "allow count mismatch")
    check(dispatcher.deny_count == 3, "deny count mismatch")
    print("PASS totals allowed=1 denied=3 reads=1 writes=1")


if __name__ == "__main__":
    run_offline_checks()
