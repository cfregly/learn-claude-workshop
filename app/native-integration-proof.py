#!/usr/bin/env python3
"""Offline bridge to the reviewed renewal Skill bundle and proof helpers."""

from __future__ import annotations

import json
import hashlib
import re
import sys
from pathlib import Path
from typing import Any


MAX_INPUT_BYTES = 2_000_000
MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 900
TOOL_VERSION = "code_execution_20260521"
BUNDLE_FILES = (
    "SKILL.md",
    "references/OUTPUT_CONTRACT.md",
    "scripts/contract.py",
    "scripts/render_brief.py",
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class ProofInputError(ValueError):
    pass


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ProofInputError("proof input exceeds its byte limit")
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProofInputError("proof input must be one JSON object") from error
    if not isinstance(value, dict):
        raise ProofInputError("proof input must be one JSON object")
    return value


def _load_lab(skill_root: Path):
    root = skill_root.resolve(strict=True)
    if not root.is_dir():
        raise ProofInputError("skill_root must be a directory")
    sys.path.insert(0, str(root))
    try:
        from renewal_skill.bundle import (  # type: ignore[import-not-found]
            BUNDLE_FILES as LAB_BUNDLE_FILES,
            bundle_manifest,
            verify_pin_bundle,
        )
        from renewal_skill.evidence import build_evidence  # type: ignore[import-not-found]
        from scripts.contract import sha256_json, validate_record  # type: ignore[import-not-found]
        from scripts.render_brief import build_brief  # type: ignore[import-not-found]
    except ImportError as error:
        raise ProofInputError("reviewed Skill helper modules could not be loaded") from error
    if tuple(LAB_BUNDLE_FILES) != BUNDLE_FILES:
        raise ProofInputError("reviewed Skill bundle allowlist changed")
    return (
        root,
        bundle_manifest,
        verify_pin_bundle,
        build_evidence,
        sha256_json,
        validate_record,
        build_brief,
    )


def _skill_root(payload: dict[str, Any]) -> Path:
    value = payload.get("skill_root")
    if not isinstance(value, str) or not Path(value).is_absolute():
        raise ProofInputError("skill_root must be an absolute trusted path")
    return Path(value)


def _inspect(payload: dict[str, Any]) -> dict[str, Any]:
    root, bundle_manifest, *_rest = _load_lab(_skill_root(payload))
    manifest = bundle_manifest(root)
    paths = tuple(item.get("path") for item in manifest.get("files", []))
    if paths != BUNDLE_FILES:
        raise ProofInputError("Skill manifest is not the strict upload allowlist")
    return {"status": "ok", "manifest": manifest}


def _validate_request(
    request: Any,
    *,
    pin: dict[str, Any],
    record: dict[str, Any],
    mcp_receipt_sha256: str,
) -> tuple[bool, str]:
    if not isinstance(request, dict):
        return False, "Messages request is not an object"
    if set(request) != {"model", "max_tokens", "thinking", "container", "messages", "tools"}:
        return False, "Messages request fields changed"
    if request.get("model") != MODEL or request.get("max_tokens") != MAX_TOKENS:
        return False, "fixed model or output limit changed"
    if request.get("thinking") != {"type": "between_tools"}:
        return False, "between_tools thinking contract changed"
    expected_skill = {
        "type": "custom",
        "skill_id": pin.get("skill_id"),
        "version": pin.get("version"),
    }
    if request.get("container") != {"skills": [expected_skill]}:
        return False, "exact Skill pin is not selected"
    if request.get("tools") != [{"type": TOOL_VERSION, "name": "code_execution"}]:
        return False, "code execution tool contract changed"
    messages = request.get("messages")
    if not isinstance(messages, list) or len(messages) != 1:
        return False, "Messages request must contain one user message"
    message = messages[0]
    if not isinstance(message, dict) or set(message) != {"role", "content"}:
        return False, "user message shape changed"
    if message.get("role") != "user" or not isinstance(message.get("content"), str):
        return False, "user message content is invalid"
    record_json = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    prompt = message["content"]
    if record_json not in prompt or mcp_receipt_sha256 not in prompt:
        return False, "prompt is not bound to the MCP record and receipt"
    skill_entries = [
        entry
        for entry in pin.get("bundle_files", [])
        if isinstance(entry, dict)
        and entry.get("path") == "SKILL.md"
        and isinstance(entry.get("sha256"), str)
        and SHA256_RE.fullmatch(entry["sha256"])
    ]
    if len(skill_entries) != 1:
        return False, "pin does not contain one SKILL.md digest"
    skill_digest = skill_entries[0]["sha256"]
    required_instruction_read = (
        "Before any other code execution command, run exactly this standalone command",
        "cat /skills/renewal-brief/SKILL.md",
        f"pinned SKILL.md SHA-256: {skill_digest}",
        "Do not combine the instruction-file read with another command",
        "After the required tool results, return one short final text sentence",
    )
    if any(item not in prompt for item in required_instruction_read):
        return False, "prompt does not require the standalone pinned SKILL.md read"
    return True, "matched"


def _verify(payload: dict[str, Any]) -> dict[str, Any]:
    (
        root,
        bundle_manifest,
        verify_pin_bundle,
        build_evidence,
        sha256_json,
        validate_record,
        build_brief,
    ) = _load_lab(_skill_root(payload))

    pin = payload.get("pin")
    record_value = payload.get("record")
    response = payload.get("response")
    request = payload.get("request")
    receipt_hash = payload.get("mcp_receipt_sha256")
    if not isinstance(pin, dict) or not isinstance(response, dict):
        raise ProofInputError("pin and response must be objects")
    if not isinstance(receipt_hash, str) or not SHA256_RE.fullmatch(receipt_hash):
        raise ProofInputError("mcp_receipt_sha256 is invalid")

    manifest = bundle_manifest(root)
    verify_pin_bundle(pin, root)
    record = validate_record(record_value)
    expected_output = build_brief(record)
    request_matched, request_reason = _validate_request(
        request,
        pin=pin,
        record=record,
        mcp_receipt_sha256=receipt_hash,
    )

    prompt = ""
    if isinstance(request, dict):
        messages = request.get("messages")
        if isinstance(messages, list) and messages and isinstance(messages[0], dict):
            value = messages[0].get("content")
            if isinstance(value, str):
                prompt = value

    evidence = build_evidence(
        response,
        pin=pin,
        requested_model=MODEL,
        requested_effort="between_tools",
        request_prompt_sha256=hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        record=record,
        expected_output=expected_output,
        max_tokens=MAX_TOKENS,
        tool_version=TOOL_VERSION,
    )

    skill_proof = evidence["skill_access_proof"]
    response_proof = evidence["response"]
    returned_output = skill_proof.get("deterministic_output")
    expected_output_sha256 = sha256_json(expected_output)
    returned_output_sha256 = (
        sha256_json(returned_output) if isinstance(returned_output, dict) else None
    )
    canonical_output_hash_matched = returned_output_sha256 == expected_output_sha256
    proof_passed = all(
        (
            request_matched,
            skill_proof["native_skill_pin_matched"],
            skill_proof["skill_instruction_file_hash_matched"],
            skill_proof["mounted_code_hash_matched"],
            skill_proof["bundled_script_invocation_succeeded"],
            skill_proof["marker_matched"],
            skill_proof["deterministic_output_matched"],
            canonical_output_hash_matched,
            response_proof["model_exact_match"],
            response_proof["stop_reason"] == "end_turn",
            response_proof["final_text_char_count"] > 0,
        )
    )

    evidence["request"].pop("output_config", None)
    evidence["request"].update(
        {
            "thinking": {"type": "between_tools"},
            "record_origin": "application_observed_mcp_stdio",
            "mcp_receipt_bound": True,
            "mcp_receipt_sha256": receipt_hash,
        }
    )
    evidence["response"].pop("returned_effort", None)
    evidence["response"].pop("effort_match", None)
    evidence["response"].pop("effort_proof", None)
    evidence["response"]["thinking_request"] = {"type": "between_tools"}
    evidence["response"]["thinking_response_persisted"] = False
    evidence["skill_access_proof"]["passed"] = proof_passed
    evidence["skill_access_proof"]["request_contract_matched"] = request_matched
    evidence["skill_access_proof"]["request_contract_reason"] = request_reason
    evidence["skill_access_proof"]["source_record_validated"] = True
    evidence["skill_access_proof"]["expected_output_sha256"] = expected_output_sha256
    evidence["skill_access_proof"]["returned_output_sha256"] = returned_output_sha256
    evidence["skill_access_proof"][
        "canonical_output_hash_matched"
    ] = canonical_output_hash_matched
    evidence["status"] = "PASS" if proof_passed else "PROOF_FAILED"
    evidence["manifest"] = manifest
    return evidence


def main() -> int:
    try:
        payload = _read_payload()
        operation = payload.get("operation")
        if operation == "inspect":
            result = _inspect(payload)
        elif operation == "verify":
            result = _verify(payload)
        else:
            raise ProofInputError("unsupported proof operation")
    except Exception as error:
        message = str(error)[:500]
        if not isinstance(error, (ProofInputError, ValueError, OSError)):
            message = "offline proof validation failed"
        result = {
            "status": "error",
            "code": "proof_input_invalid",
            "message": message,
        }
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
        return 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
