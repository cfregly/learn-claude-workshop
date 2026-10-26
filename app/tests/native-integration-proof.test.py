from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


sys.dont_write_bytecode = True
APP_ROOT = Path(__file__).resolve().parents[1]
BRIDGE = APP_ROOT / "native-integration-proof.py"
DEFAULT_REPO_ROOT = APP_ROOT.parent
REPO_ROOT = Path(os.environ.get("PR1_REPO_ROOT", DEFAULT_REPO_ROOT))
SKILL_ROOT = REPO_ROOT / "labs/skills/renewal-brief"


def bridge(payload: dict) -> tuple[int, dict]:
    environment = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONIOENCODING": "utf-8",
    }
    completed = subprocess.run(
        [sys.executable, str(BRIDGE)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        timeout=10,
        check=False,
        env=environment,
        cwd=APP_ROOT,
    )
    return completed.returncode, json.loads(completed.stdout)


@unittest.skipUnless(SKILL_ROOT.is_dir(), "reviewed PR1 Skill source is not available")
class NativeIntegrationProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        sys.path.insert(0, str(SKILL_ROOT))
        from renewal_skill.bundle import bundle_manifest
        from scripts.render_brief import render

        cls.bundle_manifest = staticmethod(bundle_manifest)
        cls.render = staticmethod(render)

    def record(self) -> dict:
        source = json.loads(
            (REPO_ROOT / "labs/source-fixtures.json").read_text(encoding="utf-8")
        )
        fixture = next(item for item in source["fixtures"] if item["id"] == "baseline")
        return {
            "synthetic": True,
            "account_id": "northstar-freight",
            "source_id": "source-fixtures.json#baseline",
            "source_ids": ["CRM", "CALL", "SUPPORT", "USAGE"],
            "notes": fixture["notes"],
            "access_checked": True,
            "actor_id": "demo-account-owner",
        }

    def fixture(self) -> tuple[dict, dict, dict, str]:
        record = self.record()
        output, marker = self.render(record)
        manifest = self.bundle_manifest(SKILL_ROOT)
        digests = {item["path"]: item["sha256"] for item in manifest["files"]}
        pin = {
            "schema_version": 1,
            "source_type": "custom",
            "operation": "create_skill",
            "skill_id": "skill_01TESTNATIVE",
            "version": "version_01TESTPIN",
            "bundle_sha256": manifest["bundle_sha256"],
            "bundle_files": manifest["files"],
        }
        receipt_hash = "a" * 64
        record_json = json.dumps(
            record, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        request = {
            "model": "claude-sonnet-5-5",
            "max_tokens": 900,
            "thinking": {"type": "between_tools"},
            "container": {
                "skills": [
                    {
                        "type": "custom",
                        "skill_id": pin["skill_id"],
                        "version": pin["version"],
                    }
                ]
            },
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"Observed MCP receipt {receipt_hash}\n"
                        "Before any other code execution command, run exactly this standalone command and wait for its successful result:\n"
                        "cat /skills/renewal-brief/SKILL.md\n"
                        "The application will hash that standalone command's complete stdout. "
                        f"It must equal the pinned SKILL.md SHA-256: {digests['SKILL.md']}\n"
                        "Do not combine the instruction-file read with another command, pipe, redirect, wrapper, comment, or output.\n"
                        "After the required tool results, return one short final text sentence.\n"
                        f"{record_json}"
                    ),
                }
            ],
            "tools": [
                {"type": "code_execution_20260521", "name": "code_execution"}
            ],
        }
        stdout = (
            "RENEWAL_BRIEF_SKILL_USED "
            + json.dumps(marker, sort_keys=True, separators=(",", ":"))
            + "\nRENEWAL_BRIEF_OUTPUT "
            + json.dumps(output, sort_keys=True, separators=(",", ":"))
        )
        response = {
            "id": "msg_test",
            "model": "claude-sonnet-5-5",
            "stop_reason": "end_turn",
            "container": {
                "id": "container_test",
                "expires_at": "2026-10-27T00:00:00Z",
                "skills": request["container"]["skills"],
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
                {"type": "thinking", "thinking": "PRIVATE THINKING MUST NOT PERSIST"},
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
                            f"{digests['scripts/contract.py']}  /skills/renewal-brief/scripts/contract.py\n"
                            f"{digests['scripts/render_brief.py']}  /skills/renewal-brief/scripts/render_brief.py\n"
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
        payload = {
            "operation": "verify",
            "skill_root": str(SKILL_ROOT),
            "pin": pin,
            "record": record,
            "mcp_receipt_sha256": receipt_hash,
            "request": request,
            "response": response,
        }
        return payload, output, manifest, receipt_hash

    def test_inspect_uses_the_strict_reviewed_bundle(self) -> None:
        code, result = bridge(
            {"operation": "inspect", "skill_root": str(SKILL_ROOT)}
        )
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(
            [item["path"] for item in result["manifest"]["files"]],
            [
                "SKILL.md",
                "references/OUTPUT_CONTRACT.md",
                "scripts/contract.py",
                "scripts/render_brief.py",
            ],
        )

    def test_sonnet_between_tools_proof_passes_without_persisting_thinking(self) -> None:
        payload, output, manifest, receipt_hash = self.fixture()
        code, result = bridge(payload)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "PASS")
        self.assertTrue(result["skill_access_proof"]["passed"])
        self.assertEqual(result["request"]["thinking"], {"type": "between_tools"})
        self.assertEqual(result["request"]["mcp_receipt_sha256"], receipt_hash)
        self.assertEqual(result["manifest"]["bundle_sha256"], manifest["bundle_sha256"])
        self.assertEqual(
            result["skill_access_proof"]["deterministic_output"], output
        )
        self.assertTrue(
            result["skill_access_proof"]["canonical_output_hash_matched"]
        )
        self.assertTrue(result["skill_access_proof"]["source_record_validated"])
        self.assertNotIn("PRIVATE THINKING MUST NOT PERSIST", json.dumps(result))
        self.assertFalse(result["privacy"]["thinking_persisted"])

    def test_request_or_terminal_drift_fails_the_native_proof(self) -> None:
        payload, _output, _manifest, _receipt_hash = self.fixture()
        bad_thinking = copy.deepcopy(payload)
        bad_thinking["request"]["thinking"] = {"type": "adaptive"}
        code, result = bridge(bad_thinking)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "PROOF_FAILED")
        self.assertFalse(result["skill_access_proof"]["request_contract_matched"])

        missing_instruction_read = copy.deepcopy(payload)
        missing_instruction_read["request"]["messages"][0]["content"] = (
            missing_instruction_read["request"]["messages"][0]["content"].replace(
                "Before any other code execution command, run exactly this standalone command",
                "Read the Skill when convenient",
            )
        )
        code, result = bridge(missing_instruction_read)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "PROOF_FAILED")
        self.assertFalse(result["skill_access_proof"]["request_contract_matched"])
        self.assertEqual(
            result["skill_access_proof"]["request_contract_reason"],
            "prompt does not require the standalone pinned SKILL.md read",
        )

        missing_short_final = copy.deepcopy(payload)
        missing_short_final["request"]["messages"][0]["content"] = (
            missing_short_final["request"]["messages"][0]["content"].replace(
                "After the required tool results, return one short final text sentence.",
                "Return a final response.",
            )
        )
        code, result = bridge(missing_short_final)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "PROOF_FAILED")
        self.assertFalse(result["skill_access_proof"]["request_contract_matched"])

        max_tokens = copy.deepcopy(payload)
        max_tokens["response"]["stop_reason"] = "max_tokens"
        code, result = bridge(max_tokens)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "PROOF_FAILED")
        self.assertFalse(result["skill_access_proof"]["passed"])

    def test_canonical_hash_rejects_python_boolean_integer_equality(self) -> None:
        payload, _output, _manifest, _receipt_hash = self.fixture()
        run_result = next(
            block
            for block in payload["response"]["content"]
            if block.get("tool_use_id") == "run_skill"
        )
        stdout = run_result["content"]["stdout"]
        changed = stdout.replace('"discount_approved":false', '"discount_approved":0')
        self.assertNotEqual(changed, stdout)
        run_result["content"]["stdout"] = changed
        code, result = bridge(payload)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "PROOF_FAILED")
        self.assertFalse(
            result["skill_access_proof"]["canonical_output_hash_matched"]
        )
        self.assertFalse(result["skill_access_proof"]["passed"])


if __name__ == "__main__":
    unittest.main()
