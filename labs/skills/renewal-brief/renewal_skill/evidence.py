from __future__ import annotations

import hashlib
import json
import re
import shlex
from pathlib import PurePosixPath
from typing import Any

from scripts.contract import sha256_json

from .io import jsonable


MARKER_PREFIX = "RENEWAL_BRIEF_SKILL_USED "
OUTPUT_PREFIX = "RENEWAL_BRIEF_OUTPUT "
SHELL_META_RE = re.compile(r"[;&|#\r\n<>`]")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def _parse_prefixed_json(stdout: str, prefix: str) -> dict[str, Any] | None:
    for line in stdout.splitlines():
        if line.startswith(prefix):
            try:
                value = json.loads(
                    line[len(prefix) :],
                    object_pairs_hook=_unique_object,
                )
            except (json.JSONDecodeError, ValueError):
                return None
            if not isinstance(value, dict):
                return None
            return value
    return None


def _bundle_digest(pin: dict[str, Any], relative_path: str) -> str | None:
    entries = pin.get("bundle_files")
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if isinstance(entry, dict) and entry.get("path") == relative_path:
            digest = entry.get("sha256")
            return digest if isinstance(digest, str) else None
    return None


def _is_absolute_skill_path(value: str, suffix: str) -> bool:
    path = PurePosixPath(value)
    return path.is_absolute() and str(path) == f"/skills/renewal-brief/{suffix}"


def _split_exact_command(command: str) -> list[str] | None:
    if not command or SHELL_META_RE.search(command):
        return None
    try:
        return shlex.split(command)
    except ValueError:
        return None


def _skill_read_path(name: str, tool_input: dict[str, Any]) -> str | None:
    if name == "text_editor_code_execution":
        path = tool_input.get("path")
        if tool_input.get("command") == "view" and isinstance(path, str):
            return path if _is_absolute_skill_path(path, "SKILL.md") else None
        return None
    if name != "bash_code_execution":
        return None
    tokens = _split_exact_command(str(tool_input.get("command", "")))
    if tokens and len(tokens) == 2 and tokens[0] == "cat":
        return tokens[1] if _is_absolute_skill_path(tokens[1], "SKILL.md") else None
    return None


def _skill_read_content(
    name: str,
    result_content: dict[str, Any],
) -> str | None:
    if name == "bash_code_execution":
        if (
            result_content.get("type") == "bash_code_execution_result"
            and result_content.get("return_code") == 0
        ):
            value = result_content.get("stdout")
            return value if isinstance(value, str) else None
        return None
    if name == "text_editor_code_execution":
        if result_content.get("type") == "text_editor_code_execution_view_result":
            value = result_content.get("content")
            return value if isinstance(value, str) else None
    return None


def _hash_command_paths(name: str, tool_input: dict[str, Any]) -> list[str] | None:
    if name != "bash_code_execution":
        return None
    tokens = _split_exact_command(str(tool_input.get("command", "")))
    if not tokens:
        return None
    if tokens[0] == "sha256sum" and len(tokens) == 3:
        paths = tokens[1:]
    elif tokens[:3] == ["shasum", "-a", "256"] and len(tokens) == 5:
        paths = tokens[3:]
    else:
        return None
    expected_suffixes = {
        "scripts/contract.py",
        "scripts/render_brief.py",
    }
    actual_suffixes = {
        suffix
        for suffix in expected_suffixes
        if any(_is_absolute_skill_path(path, suffix) for path in paths)
    }
    if actual_suffixes != expected_suffixes or len(set(paths)) != 2:
        return None
    return paths


def _hash_result_matches(
    paths: list[str] | None,
    result_content: dict[str, Any],
    pin: dict[str, Any],
) -> bool:
    if not paths:
        return False
    if (
        result_content.get("type") != "bash_code_execution_result"
        or result_content.get("return_code") != 0
    ):
        return False
    stdout = result_content.get("stdout")
    if not isinstance(stdout, str):
        return False
    observed: dict[str, str] = {}
    for line in stdout.splitlines():
        match = re.fullmatch(r"([0-9a-fA-F]{64})\s+\*?(.+)", line.strip())
        if match:
            observed[str(PurePosixPath(match.group(2)))] = match.group(1).lower()
    for relative in ("scripts/contract.py", "scripts/render_brief.py"):
        path = next(
            (item for item in paths if _is_absolute_skill_path(item, relative)), None
        )
        if path is None or observed.get(str(PurePosixPath(path))) != _bundle_digest(
            pin, relative
        ):
            return False
    return True


def _script_path(name: str, tool_input: dict[str, Any]) -> str | None:
    if name != "bash_code_execution":
        return None
    tokens = _split_exact_command(str(tool_input.get("command", "")))
    if not tokens or len(tokens) != 6:
        return None
    if tokens[0] != "python":
        return None
    script_path = tokens[1]
    if not _is_absolute_skill_path(script_path, "scripts/render_brief.py"):
        return None
    if tokens[2:4] != ["--records-file", "/tmp/renewal-records.json"]:
        return None
    if tokens[4] != "--output" or tokens[5] != "/tmp/renewal-brief.json":
        return None
    return script_path


def build_evidence(
    response: Any,
    *,
    pin: dict[str, Any],
    requested_model: str,
    requested_effort: str,
    request_prompt_sha256: str,
    record: dict[str, Any],
    expected_output: dict[str, Any],
    max_tokens: int,
    tool_version: str,
) -> dict[str, Any]:
    raw = jsonable(response)
    content = raw.get("content", [])
    if not isinstance(content, list):
        content = []

    results_by_id: dict[str, dict[str, Any]] = {}
    for block in content:
        if isinstance(block, dict) and str(block.get("type", "")).endswith(
            "_tool_result"
        ):
            tool_use_id = block.get("tool_use_id")
            if isinstance(tool_use_id, str):
                results_by_id[tool_use_id] = block

    expected_skill_digest = _bundle_digest(pin, "SKILL.md")
    skill_file_access_attempt_seen = False
    skill_file_access_seen = False
    mounted_code_hash_attempt_seen = False
    mounted_code_hash_matched = False
    script_invocation_attempt_seen = False
    script_invocation_seen = False
    marker: dict[str, Any] | None = None
    rendered_output: dict[str, Any] | None = None
    steps: list[dict[str, Any]] = []

    for block in content:
        if not isinstance(block, dict) or block.get("type") != "server_tool_use":
            continue
        name = str(block.get("name", ""))
        tool_input = block.get("input") if isinstance(block.get("input"), dict) else {}
        tool_id = str(block.get("id", ""))
        result_block = results_by_id.get(tool_id, {})
        result_content = (
            result_block.get("content") if isinstance(result_block, dict) else {}
        )
        if not isinstance(result_content, dict):
            result_content = {}
        paired_result_type_matched = bool(
            result_block and result_block.get("type") == f"{name}_tool_result"
        )

        read_path = _skill_read_path(name, tool_input)
        skill_file_access_attempt_seen = (
            skill_file_access_attempt_seen or read_path is not None
        )
        read_content = (
            _skill_read_content(name, result_content)
            if read_path and paired_result_type_matched
            else None
        )
        read_hash_matched = bool(
            read_content is not None
            and expected_skill_digest
            and hashlib.sha256(read_content.encode("utf-8")).hexdigest()
            == expected_skill_digest
        )
        skill_file_access_seen = skill_file_access_seen or read_hash_matched

        hash_paths = _hash_command_paths(name, tool_input)
        mounted_code_hash_attempt_seen = (
            mounted_code_hash_attempt_seen or hash_paths is not None
        )
        hash_matched = bool(
            paired_result_type_matched
            and _hash_result_matches(hash_paths, result_content, pin)
        )
        mounted_code_hash_matched = mounted_code_hash_matched or hash_matched

        script_path = _script_path(name, tool_input)
        script_invocation_attempt_seen = (
            script_invocation_attempt_seen or script_path is not None
        )
        script_result_succeeded = bool(
            script_path
            and paired_result_type_matched
            and result_content.get("type") == "bash_code_execution_result"
            and result_content.get("return_code") == 0
        )
        script_invocation_seen = script_invocation_seen or script_result_succeeded
        if script_result_succeeded:
            stdout = str(result_content.get("stdout", ""))
            marker = _parse_prefixed_json(stdout, MARKER_PREFIX)
            rendered_output = _parse_prefixed_json(stdout, OUTPUT_PREFIX)

        command = str(tool_input.get("command", ""))
        steps.append(
            {
                "id": tool_id,
                "name": name,
                "command_sha256": hashlib.sha256(command.encode("utf-8")).hexdigest()
                if command
                else None,
                "paired_result_seen": bool(result_block),
                "paired_result_type_matched": paired_result_type_matched,
                "skill_file_read_attempt": read_path is not None,
                "skill_file_read_hash_matched": read_hash_matched,
                "mounted_code_hash_attempt": hash_paths is not None,
                "mounted_code_hash_matched": hash_matched,
                "bundle_script_invocation_attempt": script_path is not None,
                "bundle_script_invocation_succeeded": script_result_succeeded,
                "return_code": result_content.get("return_code"),
                "result_type": result_content.get("type"),
                "generated_file_count": len(result_content.get("content", []))
                if isinstance(result_content.get("content"), list)
                else 0,
                "stderr_present": bool(result_content.get("stderr")),
            }
        )

    container = raw.get("container") if isinstance(raw.get("container"), dict) else {}
    loaded_skills = (
        container.get("skills") if isinstance(container.get("skills"), list) else []
    )
    native_skill_pin_matched = any(
        isinstance(skill, dict)
        and skill.get("type") == "custom"
        and skill.get("skill_id") == pin.get("skill_id")
        and skill.get("version") == pin.get("version")
        for skill in loaded_skills
    )

    expected_input_hash = sha256_json(record)
    expected_output_hash = sha256_json(expected_output)
    marker_matched = bool(
        marker
        and marker.get("marker") == "renewal-brief-native-v1"
        and marker.get("script") == "scripts/render_brief.py"
        and marker.get("source_id") == record.get("source_id")
        and marker.get("input_sha256") == expected_input_hash
        and marker.get("output_sha256") == expected_output_hash
    )
    rendered_output_hash = (
        sha256_json(rendered_output) if rendered_output is not None else None
    )
    deterministic_output_matched = rendered_output_hash == expected_output_hash

    returned_model = raw.get("model")
    returned_effort = raw.get("effort")
    if returned_effort is None and isinstance(raw.get("output_config"), dict):
        returned_effort = raw["output_config"].get("effort")
    model_matched = returned_model == requested_model
    effort_matched = returned_effort is None or returned_effort == requested_effort
    stop_reason = raw.get("stop_reason")
    stop_complete = stop_reason == "end_turn"

    final_text = "\n".join(
        str(block.get("text", ""))
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    )

    proof_passed = all(
        (
            native_skill_pin_matched,
            skill_file_access_seen,
            mounted_code_hash_matched,
            script_invocation_seen,
            marker_matched,
            deterministic_output_matched,
            model_matched,
            effort_matched,
            stop_complete,
        )
    )
    return {
        "schema_version": 1,
        "provider_calls": 1,
        "messages_method_invocations": 1,
        "provider_response_received": True,
        "request": {
            "model": requested_model,
            "output_config": {"effort": requested_effort},
            "max_tokens": max_tokens,
            "max_tokens_is_not_a_dollar_guarantee": True,
            "tool": tool_version,
            "prompt_sha256": request_prompt_sha256,
            "record_sha256": expected_input_hash,
            "record_origin": "caller_supplied_synthetic_record",
            "mcp_receipt_bound": False,
            "model_selected_mcp": False,
            "skill_id": pin.get("skill_id"),
            "skill_version": pin.get("version"),
            "bundle_sha256": pin.get("bundle_sha256"),
        },
        "response": {
            "id": raw.get("id"),
            "returned_model": returned_model,
            "model_exact_match": model_matched,
            "returned_effort": returned_effort,
            "effort_match": effort_matched,
            "effort_proof": (
                "response_echo"
                if returned_effort is not None
                else "accepted request output_config.effort, response schema did not echo effort"
            ),
            "stop_reason": stop_reason,
            "usage": raw.get("usage"),
            "container": {
                "id": container.get("id"),
                "expires_at": container.get("expires_at"),
                "skills": loaded_skills,
            },
            "final_text_sha256": hashlib.sha256(final_text.encode("utf-8")).hexdigest(),
            "final_text_char_count": len(final_text),
            "final_text_persisted": False,
        },
        "code_execution": {"internal_steps": len(steps), "steps": steps},
        "skill_access_proof": {
            "passed": proof_passed,
            "native_skill_pin_matched": native_skill_pin_matched,
            "skill_instruction_file_access_attempt_seen": skill_file_access_attempt_seen,
            "skill_instruction_file_hash_matched": skill_file_access_seen,
            "mounted_code_hash_attempt_seen": mounted_code_hash_attempt_seen,
            "mounted_code_hash_matched": mounted_code_hash_matched,
            "bundled_script_invocation_attempt_seen": script_invocation_attempt_seen,
            "bundled_script_invocation_succeeded": script_invocation_seen,
            "marker_matched": marker_matched,
            "deterministic_output_matched": deterministic_output_matched,
            "deterministic_output_sha256": rendered_output_hash,
            "marker": marker,
            "deterministic_output": rendered_output,
            "proof_scope": (
                "API response evidence for one resolved native Skill container and mounted bytes. "
                "The upload pin alone is not cryptographic provider-byte proof. Command matching "
                "cannot detect shell functions defined in earlier steps. The hash check and script "
                "run are not atomic. The trust anchor is the sandbox-produced tool result."
            ),
        },
        "privacy": {
            "thinking_persisted": False,
            "raw_response_persisted": False,
            "full_commands_persisted": False,
            "unrelated_stdout_persisted": False,
            "api_key_persisted": False,
            "records_declared_synthetic": record.get("synthetic") is True,
            "authorization_authentication_proven": False,
        },
    }
