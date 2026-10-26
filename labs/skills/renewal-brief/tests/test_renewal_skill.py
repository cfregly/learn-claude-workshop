from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


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
