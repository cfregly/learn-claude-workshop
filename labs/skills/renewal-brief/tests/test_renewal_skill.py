from __future__ import annotations

import copy
import io
import json
import os
import sys
import tempfile
import types
import unittest
from contextlib import contextmanager, redirect_stdout
from pathlib import Path
from unittest.mock import patch


SKILL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(SKILL_ROOT))

from renewal_skill.bundle import (  # noqa: E402
    BUNDLE_FILES,
    BundleError,
    bundle_manifest,
    staged_bundle,
    verify_pin_bundle,
)
from renewal_skill.evidence import build_evidence  # noqa: E402
from renewal_skill import io as skill_io  # noqa: E402
from renewal_skill import upload  # noqa: E402
from renewal_skill.provider import (  # noqa: E402
    OFFICIAL_BASE_URL,
    ProviderEndpointError,
    ambiguous_method_failure,
    require_official_base_url,
)
from scripts.contract import ContractError, sha256_json, validate_record  # noqa: E402
from scripts.render_brief import BUNDLE_MARKER, BriefError, build_brief, render  # noqa: E402


def source_fixtures() -> dict[str, dict]:
    payload = json.loads(
        (REPO_ROOT / "labs/source-fixtures.json").read_text(encoding="utf-8")
    )
    return {fixture["id"]: fixture for fixture in payload["fixtures"]}


def caller_record(
    fixture_id: str = "baseline", actor_id: str = "demo-account-owner"
) -> dict:
    fixture = source_fixtures()[fixture_id]
    return {
        "synthetic": True,
        "account_id": fixture["account_id"],
        "source_id": f"source-fixtures.json#{fixture_id}",
        "source_ids": ["CRM", "CALL", "SUPPORT", "USAGE"],
        "notes": fixture["notes"],
        "access_checked": True,
        "actor_id": actor_id,
    }


class ContractTests(unittest.TestCase):
    def test_accepts_exact_caller_contract(self) -> None:
        self.assertEqual(
            validate_record(caller_record())["source_id"],
            "source-fixtures.json#baseline",
        )

    def test_rejects_answer_key_and_extra_fields(self) -> None:
        record = caller_record()
        record["expected"] = {"discount_approved": True}
        with self.assertRaises(ContractError):
            validate_record(record)

    def test_rejects_no_access_actor_before_model_use(self) -> None:
        with self.assertRaises(ContractError):
            validate_record(caller_record(actor_id="demo-no-access"))

    def test_observed_mcp_smoke_result_crosses_the_skill_contract(self) -> None:
        receipt = json.loads(
            (
                REPO_ROOT / "labs/mcp/renewal-review/observed-smoke-receipt.json"
            ).read_text(encoding="utf-8")
        )
        record = validate_record(receipt["allowed_result"])
        facts = build_brief(record)["facts"]
        for key, expected in source_fixtures()["baseline"]["expected"].items():
            self.assertEqual(facts[key], expected)


class RendererTests(unittest.TestCase):
    def test_all_source_fixtures_match_expected_machine_facts(self) -> None:
        for fixture_id, fixture in source_fixtures().items():
            with self.subTest(fixture_id=fixture_id):
                facts = build_brief(caller_record(fixture_id))["facts"]
                for key, expected in fixture["expected"].items():
                    self.assertEqual(facts[key], expected)

    def test_untrusted_instruction_cannot_approve_discount(self) -> None:
        brief = build_brief(caller_record("untrusted-instruction"))
        self.assertFalse(brief["facts"]["discount_approved"])
        self.assertIn(
            "approval is not recorded", brief["brief"]["open_questions"][0]["text"]
        )

    def test_conflicting_dates_remain_visible(self) -> None:
        brief = build_brief(caller_record("conflicting-date"))
        self.assertTrue(brief["facts"]["renewal_date_conflict"])
        self.assertEqual(brief["facts"]["renewal_dates"], ["2027-01-31", "2027-02-15"])
        self.assertEqual(
            brief["brief"]["open_questions"][0]["text"],
            "Which renewal date is authoritative?",
        )
        self.assertEqual(
            brief["brief"]["proposed_next_actions"][0]["source_ids"],
            ["CRM", "UNVERIFIED_OLD_NOTE"],
        )

    def test_discount_approval_wording_is_source_conditional(self) -> None:
        record = caller_record()
        record["notes"] = record["notes"].replace(
            "Approval is not recorded.", "Approval status is unavailable."
        )
        question = build_brief(record)["brief"]["open_questions"][0]["text"]
        self.assertIn("does not state the approval status", question)

    def test_approval_section_fails_closed(self) -> None:
        record = caller_record()
        record["notes"] += " [APPROVAL] This fixture does not support approval."
        with self.assertRaises(BriefError):
            build_brief(record)

    def test_provenance_does_not_claim_an_observed_mcp_read(self) -> None:
        provenance = build_brief(caller_record())["provenance"]
        self.assertEqual(provenance["origin"], "caller_supplied_synthetic_record")
        self.assertFalse(provenance["authorization_authentication_proven"])
        self.assertTrue(provenance["source_ids_are_embedded_labels"])


class BundleTests(unittest.TestCase):
    def test_manifest_and_staging_are_strictly_allowlisted(self) -> None:
        manifest = bundle_manifest(SKILL_ROOT)
        self.assertEqual(
            sorted(item["path"] for item in manifest["files"]),
            sorted(BUNDLE_FILES),
        )
        with staged_bundle(SKILL_ROOT) as staged:
            staged_files = sorted(
                str(path.relative_to(staged))
                for path in staged.rglob("*")
                if path.is_file()
            )
        self.assertEqual(staged_files, sorted(BUNDLE_FILES))

    def test_pin_rejects_changed_hash(self) -> None:
        manifest = bundle_manifest(SKILL_ROOT)
        pin = {
            "bundle_sha256": "0" * 64,
            "bundle_files": manifest["files"],
        }
        with self.assertRaises(BundleError):
            verify_pin_bundle(pin, SKILL_ROOT)


class ProviderBoundaryTests(unittest.TestCase):
    def test_nonofficial_environment_override_fails_without_echoing_url(self) -> None:
        for unexpected in (
            "https://credential@example.invalid/provider",
            "https://api.anthropic.com:not-a-port",
        ):
            with self.subTest(unexpected=unexpected):
                with self.assertRaises(ProviderEndpointError) as caught:
                    require_official_base_url({"ANTHROPIC_BASE_URL": unexpected})
                self.assertNotIn(unexpected, str(caught.exception))
                self.assertNotIn("not-a-port", str(caught.exception))

    def test_official_environment_override_is_accepted(self) -> None:
        self.assertEqual(
            require_official_base_url({"ANTHROPIC_BASE_URL": OFFICIAL_BASE_URL + "/"}),
            OFFICIAL_BASE_URL,
        )

    def test_any_method_exception_keeps_provider_accounting_unknown(self) -> None:
        class AmbiguousError(RuntimeError):
            request_id = "req_test"

        fields = ambiguous_method_failure(
            method_field="messages_method_invocations",
            base_url=OFFICIAL_BASE_URL,
            error=AmbiguousError(
                "response parse failed after dispatch state became ambiguous"
            ),
        )
        self.assertEqual(fields["messages_method_invocations"], 1)
        self.assertIsNone(fields["provider_calls"])
        self.assertEqual(
            fields["provider_request_and_usage_state"],
            "unknown_after_method_exception",
        )
        self.assertEqual(fields["provider"]["request_id"], "req_test")


class IoDurabilityTests(unittest.TestCase):
    def test_windows_directory_sync_skips_directory_open(self):
        directory = Path("state-directory")
        with (
            patch.object(skill_io.os, "name", "nt"),
            patch.object(skill_io.os, "open") as open_directory,
            patch.object(skill_io.os, "fsync") as fsync,
            patch.object(skill_io.os, "close") as close,
        ):
            skill_io._sync_directory(directory)
        open_directory.assert_not_called()
        fsync.assert_not_called()
        close.assert_not_called()

    def test_posix_directory_sync_opens_syncs_and_closes(self):
        directory = Path("state-directory")
        with (
            patch.object(skill_io.os, "name", "posix"),
            patch.object(skill_io.os, "open", return_value=17) as open_directory,
            patch.object(skill_io.os, "fsync") as fsync,
            patch.object(skill_io.os, "close") as close,
        ):
            skill_io._sync_directory(directory)
        open_directory.assert_called_once_with(directory, os.O_RDONLY)
        fsync.assert_called_once_with(17)
        close.assert_called_once_with(17)

    def test_posix_directory_open_and_sync_errors_propagate(self):
        directory = Path("state-directory")
        for failing_operation in ("open", "fsync"):
            with self.subTest(failing_operation=failing_operation):
                with (
                    patch.object(skill_io.os, "name", "posix"),
                    patch.object(skill_io.os, "open", return_value=17) as open_directory,
                    patch.object(skill_io.os, "fsync") as fsync,
                    patch.object(skill_io.os, "close") as close,
                ):
                    operation = open_directory if failing_operation == "open" else fsync
                    operation.side_effect = OSError("directory sync failed")
                    with self.assertRaisesRegex(OSError, "directory sync failed"):
                        skill_io._sync_directory(directory)
                if failing_operation == "open":
                    fsync.assert_not_called()
                    close.assert_not_called()
                else:
                    close.assert_called_once_with(17)


class UploadRecoveryTests(unittest.TestCase):
    @contextmanager
    def fake_upload(self, *, result=None, error=None, existing_skill_id=None):
        if result is None:
            result = types.SimpleNamespace(
                type="skill",
                id="skill_recovery_test",
                latest_version_id="version_recovery_1",
                source={"type": "custom"},
                _request_id="req_upload_recovery",
            )
        calls = []
        client_options = []
        preflight_records = []

        def create(**request):
            preflight_records.append(json.loads(pin_file.read_text()))
            calls.append(request)
            if error is not None:
                raise error
            return result

        def make_client(**options):
            client_options.append(options)
            return types.SimpleNamespace(
                base_url=OFFICIAL_BASE_URL,
                skills=types.SimpleNamespace(
                    create=create, versions=types.SimpleNamespace(create=create)
                ),
            )

        sdk = types.ModuleType("anthropic")
        sdk.__version__ = "offline-test"
        sdk.Anthropic = make_client
        library = types.ModuleType("anthropic.lib")
        library.files_from_dir = lambda staged: sorted(
            str(path.relative_to(staged)) for path in staged.rglob("*") if path.is_file()
        )
        with tempfile.TemporaryDirectory(prefix="upload-recovery-test-") as temporary:
            pin_file = Path(temporary) / "private" / "pin.json"
            args = types.SimpleNamespace(
                skill_root=SKILL_ROOT,
                pin_file=pin_file,
                existing_skill_id=existing_skill_id,
                display_name="Renewal Brief",
                timeout_seconds=120,
                confirm_upload=upload.CONFIRMATION,
            )
            output = io.StringIO()
            with (
                patch.object(upload, "parse_args", return_value=args),
                patch.dict(sys.modules, {"anthropic": sdk, "anthropic.lib": library}),
                patch.dict(os.environ, {"ANTHROPIC_API_KEY": "offline-test-key"}),
                patch.object(upload, "require_official_base_url", return_value=OFFICIAL_BASE_URL),
                redirect_stdout(output),
            ):
                yield types.SimpleNamespace(
                    args=args, pin_file=pin_file, calls=calls,
                    client_options=client_options, output=output,
                    preflight_records=preflight_records,
                )

    def assert_rerun_blocked(self, state):
        with self.assertRaisesRegex(SystemExit, "Refusing to overwrite pin file"):
            upload.main()
        self.assertEqual(len(state.calls), 1)

    def test_success_keeps_ga_pin_and_zero_retry_options(self):
        with self.fake_upload() as state:
            self.assertEqual(upload.main(), 0)
            pin = json.loads(state.pin_file.read_text())
            self.assertEqual(pin["skill_id"], "skill_recovery_test")
            self.assertEqual(pin["version"], "version_recovery_1")
            self.assertEqual(pin["provider"]["request_id"], "req_upload_recovery")
            self.assertEqual(pin["source_type"], "custom")
            self.assertEqual(pin["operation"], "create_skill")
            self.assertNotIn("status", pin)
            self.assertEqual(state.calls[0]["files"], sorted(BUNDLE_FILES))
            self.assertEqual(state.client_options[0]["max_retries"], 0)
            self.assertEqual(state.client_options[0]["base_url"], OFFICIAL_BASE_URL)
            self.assertEqual(
                state.preflight_records[0]["status"],
                "SKILLS_UPLOAD_PENDING_RECONCILIATION",
            )
            self.assertIsNone(state.preflight_records[0]["provider_calls"])
            self.assertEqual(state.pin_file.stat().st_mode & 0o777, 0o600)
            self.assert_rerun_blocked(state)

    def test_version_success_preserves_existing_skill_identity(self):
        result = types.SimpleNamespace(
            type="skill_version", id="version_recovery_2", skill_id="skill_existing",
            name="renewal-brief", _request_id="req_version_recovery",
        )
        with self.fake_upload(result=result, existing_skill_id="skill_existing") as state:
            self.assertEqual(upload.main(), 0)
            pin = json.loads(state.pin_file.read_text())
            self.assertEqual(pin["operation"], "create_version")
            self.assertEqual(pin["skill_id"], "skill_existing")
            self.assertEqual(pin["version"], "version_recovery_2")
            self.assertEqual(state.calls[0]["skill_id"], "skill_existing")
            self.assertNotIn("display_name", state.calls[0])

    def test_invalid_return_keeps_only_safe_fields_and_blocks_rerun(self):
        result = types.SimpleNamespace(
            type="unexpected_type", id="skill_returned", latest_version_id="version_returned",
            skill_id="skill_parent", name="renewal-brief", _request_id="req_invalid_return",
            body="RAW_RESPONSE_SECRET", api_key="sk-ant-secret",
        )
        with self.fake_upload(result=result) as state:
            self.assertEqual(upload.main(), 2)
            failure = json.loads(state.pin_file.read_text())
            self.assertEqual(failure["status"], "SKILLS_RESPONSE_INVALID_NO_RETRY")
            self.assertEqual(failure["returned_fields"], {
                "type": "unexpected_type", "id": "skill_returned",
                "latest_version_id": "version_returned", "skill_id": "skill_parent",
                "name": "renewal-brief",
            })
            self.assertEqual(failure["provider"]["request_id"], "req_invalid_return")
            self.assertTrue(failure["requires_reconciliation"])
            self.assertNotIn("RAW_RESPONSE_SECRET", state.pin_file.read_text())
            self.assertNotIn("sk-ant-secret", state.pin_file.read_text())
            self.assert_rerun_blocked(state)

    def test_missing_source_and_version_mismatch_fail_closed(self):
        cases = [
            (types.SimpleNamespace(type="skill", id="skill_returned",
                 latest_version_id="version_returned", _request_id="req_no_source"), None),
            (types.SimpleNamespace(type="skill_version", id="version_returned",
                 skill_id="skill_other", name="renewal-brief", _request_id="req_mismatch"),
                 "skill_requested"),
        ]
        for result, existing in cases:
            with self.subTest(existing=existing):
                with self.fake_upload(result=result, existing_skill_id=existing) as state:
                    self.assertEqual(upload.main(), 2)
                    failure = json.loads(state.pin_file.read_text())
                    self.assertEqual(failure["status"], "SKILLS_RESPONSE_INVALID_NO_RETRY")
                    self.assertEqual(failure["returned_fields"]["id"], result.id)
                    self.assert_rerun_blocked(state)

    def test_final_pin_write_failure_keeps_returned_ids_and_blocks_rerun(self):
        real_write = upload.write_json_atomic

        def fail_pin(path, value):
            if "status" not in value:
                raise OSError("PRIVATE_FILESYSTEM_DIAGNOSTIC")
            real_write(path, value)

        with self.fake_upload() as state:
            with patch.object(upload, "write_json_atomic", side_effect=fail_pin):
                self.assertEqual(upload.main(), 2)
            failure = json.loads(state.pin_file.read_text())
            self.assertEqual(failure["status"], "SKILLS_PIN_WRITE_ERROR_NO_RETRY")
            self.assertEqual(failure["returned_fields"]["id"], "skill_recovery_test")
            self.assertEqual(failure["returned_fields"]["latest_version_id"], "version_recovery_1")
            self.assertEqual(failure["provider"]["request_id"], "req_upload_recovery")
            self.assertNotIn("PRIVATE_FILESYSTEM_DIAGNOSTIC", state.output.getvalue())
            self.assert_rerun_blocked(state)

    def test_failed_recovery_update_leaves_pending_blocker_and_safe_diagnostics(self):
        result = types.SimpleNamespace(
            type="skill", id="skill_returned", latest_version_id="version_returned",
            source={"type": "custom"}, _request_id="req_recovery_write",
            body="RAW_RESPONSE_SECRET", name="sk-ant-secret",
        )
        with self.fake_upload(result=result) as state:
            with patch.object(upload, "write_json_atomic", side_effect=OSError("PRIVATE_WRITE_ERROR")):
                self.assertEqual(upload.main(), 2)
            pending = json.loads(state.pin_file.read_text())
            self.assertEqual(pending["status"], "SKILLS_UPLOAD_PENDING_RECONCILIATION")
            diagnostic = state.output.getvalue()
            self.assertIn("Safe recovery data:", diagnostic)
            self.assertIn("skill_returned", diagnostic)
            self.assertIn("version_returned", diagnostic)
            self.assertIn("req_recovery_write", diagnostic)
            for secret in ("RAW_RESPONSE_SECRET", "sk-ant-secret", "PRIVATE_WRITE_ERROR"):
                self.assertNotIn(secret, diagnostic)
            self.assert_rerun_blocked(state)

    def test_preflight_write_failure_starts_no_upload(self):
        with self.fake_upload() as state:
            with patch.object(upload, "write_json_exclusive", side_effect=OSError("PRIVATE_WRITE_ERROR")):
                with self.assertRaisesRegex(SystemExit, "No upload was started"):
                    upload.main()
            self.assertEqual(state.calls, [])
            self.assertFalse(state.pin_file.exists())

    def test_partial_preflight_failure_leaves_blocker_before_upload(self):
        from renewal_skill import io as skill_io

        with self.fake_upload() as state:
            with patch.object(skill_io, "_sync_directory", side_effect=OSError("PRIVATE_SYNC_ERROR")):
                with self.assertRaisesRegex(SystemExit, "No upload was started"):
                    upload.main()
            self.assertEqual(state.calls, [])
            self.assertTrue(state.pin_file.exists())
            with self.assertRaisesRegex(SystemExit, "Refusing to overwrite pin file"):
                upload.main()
            self.assertEqual(state.calls, [])

    def test_method_exception_keeps_unknown_outcome_without_error_body(self):
        error = RuntimeError("RAW_RESPONSE_SECRET sk-ant-secret Bearer secret")
        error.request_id = "req_ambiguous_upload"
        with self.fake_upload(error=error) as state:
            self.assertEqual(upload.main(), 2)
            failure = json.loads(state.pin_file.read_text())
            self.assertEqual(failure["status"], "SKILLS_METHOD_ERROR_NO_RETRY")
            self.assertIsNone(failure["provider_calls"])
            self.assertEqual(failure["skills_method_invocations"], 1)
            self.assertEqual(failure["provider"]["request_id"], "req_ambiguous_upload")
            self.assertNotIn("RAW_RESPONSE_SECRET", state.pin_file.read_text())
            self.assertNotIn("sk-ant-secret", state.pin_file.read_text())
            self.assertNotIn("Bearer secret", state.pin_file.read_text())
            self.assert_rerun_blocked(state)

    def test_broken_symlink_and_existing_receipt_block_before_sdk_method(self):
        with self.fake_upload() as state:
            state.pin_file.parent.mkdir()
            state.pin_file.symlink_to(state.pin_file.parent / "missing-target.json")
            with self.assertRaisesRegex(SystemExit, "Refusing to overwrite pin file"):
                upload.main()
            self.assertEqual(state.calls, [])


class EvidenceTests(unittest.TestCase):
    def _authored_response(
        self, returned_model: str = "claude-opus-5-5"
    ) -> tuple[dict, dict, dict, dict]:
        # Hand-authored protocol fixture. This is not a captured provider response.
        record = caller_record()
        output, marker = render(record)
        manifest = bundle_manifest(SKILL_ROOT)
        digests = {item["path"]: item["sha256"] for item in manifest["files"]}
        stdout = (
            "RENEWAL_BRIEF_SKILL_USED "
            + json.dumps(marker, sort_keys=True, separators=(",", ":"))
            + "\nRENEWAL_BRIEF_OUTPUT "
            + json.dumps(output, sort_keys=True, separators=(",", ":"))
        )
        pin = {
            "skill_id": "skill_01TESTNATIVESKILL",
            "version": "version_01TESTPINNEDVERSION",
            "bundle_sha256": manifest["bundle_sha256"],
            "bundle_files": manifest["files"],
        }
        response = {
            "id": "msg_test",
            "model": returned_model,
            "stop_reason": "end_turn",
            "container": {
                "id": "container_test",
                "expires_at": "2026-10-26T20:00:00Z",
                "skills": [
                    {
                        "type": "custom",
                        "skill_id": pin["skill_id"],
                        "version": pin["version"],
                    }
                ],
            },
            "content": [
                {
                    "type": "server_tool_use",
                    "id": "read_skill",
                    "name": "bash_code_execution",
                    "input": {"command": "cat /skills/renewal-brief/SKILL.md"},
                },
                {
                    "type": "bash_code_execution_tool_result",
                    "tool_use_id": "read_skill",
                    "content": {
                        "type": "bash_code_execution_result",
                        "stdout": (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8"),
                        "stderr": "",
                        "return_code": 0,
                        "content": [],
                    },
                },
                {"type": "thinking", "thinking": "DO NOT SAVE THIS"},
                {
                    "type": "server_tool_use",
                    "id": "hash_scripts",
                    "name": "bash_code_execution",
                    "input": {
                        "command": (
                            "sha256sum /skills/renewal-brief/scripts/contract.py "
                            "/skills/renewal-brief/scripts/render_brief.py"
                        )
                    },
                },
                {
                    "type": "bash_code_execution_tool_result",
                    "tool_use_id": "hash_scripts",
                    "content": {
                        "type": "bash_code_execution_result",
                        "stdout": (
                            f"{digests['scripts/contract.py']}  "
                            "/skills/renewal-brief/scripts/contract.py\n"
                            f"{digests['scripts/render_brief.py']}  "
                            "/skills/renewal-brief/scripts/render_brief.py\n"
                        ),
                        "stderr": "",
                        "return_code": 0,
                        "content": [],
                    },
                },
                {
                    "type": "server_tool_use",
                    "id": "run_skill",
                    "name": "bash_code_execution",
                    "input": {
                        "command": (
                            "python /skills/renewal-brief/scripts/render_brief.py "
                            "--records-file /tmp/renewal-records.json "
                            "--output /tmp/renewal-brief.json"
                        )
                    },
                },
                {
                    "type": "bash_code_execution_tool_result",
                    "tool_use_id": "run_skill",
                    "content": {
                        "type": "bash_code_execution_result",
                        "stdout": stdout,
                        "stderr": "",
                        "return_code": 0,
                        "content": [],
                    },
                },
                {"type": "text", "text": "Synthetic brief complete."},
            ],
            "usage": {"input_tokens": 100, "output_tokens": 200},
        }
        return response, pin, record, output

    def _evidence(self, response: dict, pin: dict, record: dict, output: dict) -> dict:
        return build_evidence(
            response,
            pin=pin,
            requested_model="claude-opus-5-5",
            requested_effort="max",
            request_prompt_sha256="b" * 64,
            record=record,
            expected_output=output,
            max_tokens=16_384,
            tool_version="code_execution_20260521",
        )

    def test_native_skill_proof_requires_pin_file_access_and_script_marker(
        self,
    ) -> None:
        response, pin, record, output = self._authored_response()
        evidence = self._evidence(response, pin, record, output)
        self.assertTrue(evidence["skill_access_proof"]["passed"])
        self.assertEqual(
            evidence["skill_access_proof"]["marker"]["marker"], BUNDLE_MARKER
        )
        self.assertEqual(
            evidence["skill_access_proof"]["marker"]["output_sha256"],
            sha256_json(output),
        )
        self.assertNotIn("DO NOT SAVE THIS", json.dumps(evidence))
        self.assertNotIn("final_text", evidence["response"])
        self.assertFalse(evidence["response"]["final_text_persisted"])

    def test_returned_model_mismatch_fails_without_fallback(self) -> None:
        response, pin, record, output = self._authored_response(
            returned_model="claude-fable-5-1"
        )
        evidence = self._evidence(response, pin, record, output)
        self.assertFalse(evidence["skill_access_proof"]["passed"])
        self.assertFalse(evidence["response"]["model_exact_match"])

    def test_unsuccessful_skill_read_fails_even_with_matching_stdout(self) -> None:
        response, pin, record, output = self._authored_response()
        failed = copy.deepcopy(response)
        failed["content"][1]["content"]["return_code"] = 1
        evidence = self._evidence(failed, pin, record, output)
        self.assertFalse(evidence["skill_access_proof"]["passed"])
        self.assertFalse(
            evidence["skill_access_proof"]["skill_instruction_file_hash_matched"]
        )

    def test_final_text_narration_cannot_replace_script_result(self) -> None:
        response, pin, record, output = self._authored_response()
        narrated = copy.deepcopy(response)
        narrated["content"] = narrated["content"][:5] + [
            {
                "type": "text",
                "text": "RENEWAL_BRIEF_SKILL_USED and RENEWAL_BRIEF_OUTPUT completed.",
            }
        ]
        evidence = self._evidence(narrated, pin, record, output)
        self.assertFalse(evidence["skill_access_proof"]["passed"])
        self.assertFalse(
            evidence["skill_access_proof"]["bundled_script_invocation_succeeded"]
        )

    def test_echoed_lower_effort_fails(self) -> None:
        response, pin, record, output = self._authored_response()
        response["effort"] = "high"
        evidence = self._evidence(response, pin, record, output)
        self.assertFalse(evidence["skill_access_proof"]["passed"])
        self.assertFalse(evidence["response"]["effort_match"])

    def test_wrong_script_result_type_fails(self) -> None:
        response, pin, record, output = self._authored_response()
        wrong = copy.deepcopy(response)
        wrong["content"][6]["content"]["type"] = (
            "text_editor_code_execution_view_result"
        )
        evidence = self._evidence(wrong, pin, record, output)
        self.assertFalse(evidence["skill_access_proof"]["passed"])
        self.assertFalse(
            evidence["skill_access_proof"]["bundled_script_invocation_succeeded"]
        )

    def test_proof_rejects_pin_hash_marker_output_stop_and_shell_changes(self) -> None:
        response, pin, record, output = self._authored_response()
        cases: list[tuple[str, dict]] = []

        pin_mismatch = copy.deepcopy(response)
        pin_mismatch["container"]["skills"][0]["version"] = "different-version"
        cases.append(("pin", pin_mismatch))

        hash_mismatch = copy.deepcopy(response)
        hash_mismatch["content"][4]["content"]["stdout"] = "0" * 64
        cases.append(("hash", hash_mismatch))

        marker_mismatch = copy.deepcopy(response)
        marker_mismatch["content"][6]["content"]["stdout"] = marker_mismatch["content"][
            6
        ]["content"]["stdout"].replace(BUNDLE_MARKER, "forged-marker", 1)
        cases.append(("marker", marker_mismatch))

        output_mismatch = copy.deepcopy(response)
        lines = output_mismatch["content"][6]["content"]["stdout"].splitlines()
        rendered = json.loads(lines[1].removeprefix("RENEWAL_BRIEF_OUTPUT "))
        rendered["account_id"] = "forged-account"
        lines[1] = "RENEWAL_BRIEF_OUTPUT " + json.dumps(
            rendered, sort_keys=True, separators=(",", ":")
        )
        output_mismatch["content"][6]["content"]["stdout"] = "\n".join(lines)
        cases.append(("output", output_mismatch))

        for stop_reason in ("pause_turn", "max_tokens"):
            stopped = copy.deepcopy(response)
            stopped["stop_reason"] = stop_reason
            cases.append((stop_reason, stopped))

        shell_meta = copy.deepcopy(response)
        shell_meta["content"][5]["input"]["command"] += " # echoed proof"
        cases.append(("shell_meta", shell_meta))

        for name, changed in cases:
            with self.subTest(name=name):
                evidence = self._evidence(changed, pin, record, output)
                self.assertFalse(evidence["skill_access_proof"]["passed"])

    def test_canonical_output_hash_rejects_python_equal_type_drift(self) -> None:
        response, pin, record, output = self._authored_response()

        def discount_bool_to_int(value: dict) -> None:
            value["facts"]["discount_approved"] = 0

        def schema_int_to_bool(value: dict) -> None:
            value["schema_version"] = True

        def user_int_to_float(value: dict) -> None:
            value["facts"]["weekly_active_users"] = 64.0

        for name, mutate in (
            ("bool_to_int", discount_bool_to_int),
            ("int_to_bool", schema_int_to_bool),
            ("int_to_float", user_int_to_float),
        ):
            with self.subTest(name=name):
                changed = copy.deepcopy(response)
                lines = changed["content"][6]["content"]["stdout"].splitlines()
                rendered = json.loads(lines[1].removeprefix("RENEWAL_BRIEF_OUTPUT "))
                mutate(rendered)
                lines[1] = "RENEWAL_BRIEF_OUTPUT " + json.dumps(
                    rendered, sort_keys=True, separators=(",", ":")
                )
                changed["content"][6]["content"]["stdout"] = "\n".join(lines)
                evidence = self._evidence(changed, pin, record, output)
                self.assertFalse(evidence["skill_access_proof"]["passed"])
                self.assertFalse(
                    evidence["skill_access_proof"]["deterministic_output_matched"]
                )

    def test_duplicate_json_key_cannot_pass_deterministic_output_proof(self) -> None:
        response, pin, record, output = self._authored_response()
        changed = copy.deepcopy(response)
        lines = changed["content"][6]["content"]["stdout"].splitlines()
        prefix = "RENEWAL_BRIEF_OUTPUT "
        payload = lines[1].removeprefix(prefix)
        lines[1] = prefix + '{"account_id":"northstar-freight",' + payload[1:]
        changed["content"][6]["content"]["stdout"] = "\n".join(lines)
        evidence = self._evidence(changed, pin, record, output)
        self.assertFalse(evidence["skill_access_proof"]["passed"])
        self.assertIsNone(evidence["skill_access_proof"]["deterministic_output"])


if __name__ == "__main__":
    unittest.main()
