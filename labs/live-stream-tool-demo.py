#!/usr/bin/env python3
"""Live Claude streaming lab with one local read-only synthetic tool.

The default command is offline. Importing this module does not import the
Anthropic SDK, read a credential, call a tool, or make a network request.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, TextIO


ACCOUNT_ID = "northstar-freight"
TOOL_NAME = "lookup_northstar_account"
FIXTURE_PATH = Path(__file__).with_name("source-fixtures.json")
API_VERSION = "2026-10-21"
PROVIDER_TIMEOUT_SECONDS = 60.0
SONNET_BETWEEN_TOOLS_MODEL = "claude-sonnet-5-5"
SYNTHETIC_CALLER_CONTEXT = {
    "actor_id": "demo-account-owner",
    "authorized_account_ids": [ACCOUNT_ID],
}
SYSTEM_PROMPT = (
    "This is a synthetic teaching exercise. Use only the record returned by "
    "lookup_northstar_account. Call that tool exactly once with account_id "
    "northstar-freight before drafting. Preserve missing approval and entitlement "
    "facts. Do not infer a cause for the usage change. Do not claim that any "
    "external system changed or that a customer action was approved."
)
USER_PROMPT = (
    "Prepare a concise source-bound renewal brief for Northstar Freight. Include "
    "the owner, renewal date, discount status, SSO status, open support case, "
    "weekly active users, and unresolved follow-up."
)
TOOL_DEFINITION = {
    "name": TOOL_NAME,
    "description": (
        "Read the one approved synthetic Northstar teaching record from a local "
        "fixture. This tool has no CRM or network access."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "enum": [ACCOUNT_ID],
            }
        },
        "required": ["account_id"],
        "additionalProperties": False,
    },
}

EXIT_CONFIG = 2
EXIT_INCOMPLETE = 3
EXIT_PROTOCOL = 4


class LabError(RuntimeError):
    """A bounded lab failure with a stable process exit code."""

    def __init__(self, message: str, exit_code: int) -> None:
        super().__init__(message)
        self.exit_code = exit_code


@dataclass(frozen=True)
class StreamOutcome:
    complete: bool
    message: Any | None
    partial_text: str
    error: str | None


def _value(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(name, default)
    return getattr(value, name, default)


def _block_to_dict(block: Any) -> dict[str, Any]:
    if isinstance(block, Mapping):
        return json.loads(json.dumps(dict(block)))
    to_dict = getattr(block, "to_dict", None)
    if callable(to_dict):
        return to_dict(mode="json")
    raise LabError("The SDK returned an unsupported content block.", EXIT_PROTOCOL)


def _request_envelope(
    model: str,
    max_tokens: int,
    messages: list[dict[str, Any]],
) -> dict[str, Any]:
    request: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "system": SYSTEM_PROMPT,
        "tools": [TOOL_DEFINITION],
        "messages": messages,
    }
    if model == SONNET_BETWEEN_TOOLS_MODEL:
        request["thinking"] = {"type": "between_tools"}
    return request


def build_first_request(model: str) -> dict[str, Any]:
    return _request_envelope(
        model,
        700,
        [{"role": "user", "content": USER_PROMPT}],
    )


def build_second_request(
    model: str,
    messages: list[dict[str, Any]],
) -> dict[str, Any]:
    return _request_envelope(model, 900, messages)


def build_sdk_client(auth_token: str, client_class: Callable[..., Any]) -> Any:
    """Build one no-retry Bearer client without allowing API key fallback."""
    return client_class(
        auth_token=auth_token,
        default_headers={"anthropic-version": API_VERSION},
        max_retries=0,
        timeout=PROVIDER_TIMEOUT_SECONDS,
    )


def lookup_northstar_account(account_id: str) -> dict[str, Any]:
    """Return one bundled synthetic record after a local allowlist check."""
    if account_id not in SYNTHETIC_CALLER_CONTEXT["authorized_account_ids"]:
        raise LabError("The account is not in this lab's allowlist.", EXIT_PROTOCOL)

    try:
        source = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LabError("The bundled synthetic fixture could not be read.", EXIT_PROTOCOL) from exc

    if source.get("synthetic") is not True:
        raise LabError("The fixture is not marked synthetic.", EXIT_PROTOCOL)

    matches = [
        item
        for item in source.get("fixtures", [])
        if item.get("id") == "baseline" and item.get("account_id") == account_id
    ]
    if len(matches) != 1:
        raise LabError("The approved baseline fixture is missing or ambiguous.", EXIT_PROTOCOL)

    fixture = matches[0]
    fixture_caller = fixture.get("caller", {})
    if (
        fixture_caller.get("employee") != SYNTHETIC_CALLER_CONTEXT["actor_id"]
        or fixture_caller.get("allowed_accounts")
        != SYNTHETIC_CALLER_CONTEXT["authorized_account_ids"]
    ):
        raise LabError("The fixture caller does not match the lab policy.", EXIT_PROTOCOL)

    return {
        "synthetic": True,
        "read_only": True,
        "account_id": account_id,
        "caller_fixture": SYNTHETIC_CALLER_CONTEXT["actor_id"],
        "source_id": "source-fixtures.json#baseline",
        "notes": fixture["notes"],
    }


def stream_message(
    client: Any,
    request: dict[str, Any],
    output: TextIO,
) -> StreamOutcome:
    """Consume raw provider events and retain partial text on interruption."""
    fragments: list[str] = []
    saw_message_stop = False
    event_error: str | None = None
    final_message: Any | None = None

    try:
        with client.messages.stream(**request) as stream:
            for event in stream:
                event_type = _value(event, "type")
                if event_type == "content_block_start":
                    block = _value(event, "content_block")
                    if _value(block, "type") == "tool_use":
                        output.write(f"\n[provider requested {TOOL_NAME}]\n")
                        output.flush()
                elif event_type == "content_block_delta":
                    delta = _value(event, "delta")
                    if _value(delta, "type") == "text_delta":
                        text = _value(delta, "text", "")
                        fragments.append(text)
                        output.write(text)
                        output.flush()
                elif event_type == "error":
                    error = _value(event, "error")
                    event_error = _value(error, "message", "provider stream error")
                elif event_type == "message_stop":
                    saw_message_stop = True

            if event_error is None and saw_message_stop:
                final_message = stream.get_final_message()
    except Exception as exc:
        return StreamOutcome(
            complete=False,
            message=None,
            partial_text="".join(fragments),
            error=f"{type(exc).__name__}: {exc}",
        )

    if event_error is not None:
        return StreamOutcome(False, None, "".join(fragments), event_error)
    if not saw_message_stop:
        return StreamOutcome(
            False,
            None,
            "".join(fragments),
            "stream ended without message_stop",
        )
    if final_message is None:
        return StreamOutcome(False, None, "".join(fragments), "final Message is missing")
    return StreamOutcome(True, final_message, "".join(fragments), None)


def _require_complete(outcome: StreamOutcome, label: str, output: TextIO) -> Any:
    if not outcome.complete:
        output.write("\nstatus=incomplete\n")
        output.flush()
        detail = outcome.error or "unknown stream failure"
        raise LabError(f"{label} did not complete: {detail}", EXIT_INCOMPLETE)
    return outcome.message


def _validated_tool_use(content: list[dict[str, Any]]) -> dict[str, Any]:
    tool_blocks = [block for block in content if block.get("type") == "tool_use"]
    if len(tool_blocks) != 1:
        raise LabError("The first response must contain exactly one tool request.", EXIT_PROTOCOL)

    block = tool_blocks[0]
    if block.get("name") != TOOL_NAME:
        raise LabError("The provider requested an unrecognized tool.", EXIT_PROTOCOL)
    tool_id = block.get("id")
    if not isinstance(tool_id, str) or not tool_id:
        raise LabError("The tool request is missing its ID.", EXIT_PROTOCOL)
    tool_input = block.get("input")
    if not isinstance(tool_input, dict) or set(tool_input) != {"account_id"}:
        raise LabError("The tool input must contain only account_id.", EXIT_PROTOCOL)
    if tool_input["account_id"] != ACCOUNT_ID:
        raise LabError("The requested account is outside the lab allowlist.", EXIT_PROTOCOL)
    return block


def run_live(
    client: Any,
    model: str,
    output: TextIO = sys.stdout,
    lookup: Callable[[str], dict[str, Any]] = lookup_northstar_account,
) -> None:
    """Run two provider streams with exactly one local read-only lookup."""
    first_request = build_first_request(model)
    output.write("provider_stream=1\n")
    first = stream_message(client, first_request, output)
    first_message = _require_complete(first, "The first provider stream", output)
    if _value(first_message, "stop_reason") != "tool_use":
        raise LabError("The first response ended without the required tool request.", EXIT_PROTOCOL)

    raw_content = _value(first_message, "content")
    if not isinstance(raw_content, list):
        raise LabError("The first response content is malformed.", EXIT_PROTOCOL)
    assistant_content = [_block_to_dict(block) for block in raw_content]
    tool_use = _validated_tool_use(assistant_content)

    tool_result = lookup(tool_use["input"]["account_id"])
    output.write("\nlookup_status=completed_read_only_synthetic\n")
    output.write("provider_stream=2\n")
    output.flush()

    continuation_messages = list(first_request["messages"])
    continuation_messages.extend(
        [
            {"role": "assistant", "content": assistant_content},
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use["id"],
                        "content": json.dumps(tool_result, sort_keys=True),
                    }
                ],
            },
        ]
    )
    second_request = build_second_request(model, continuation_messages)
    second = stream_message(client, second_request, output)
    second_message = _require_complete(second, "The final provider stream", output)
    if _value(second_message, "stop_reason") != "end_turn":
        output.write("\nstatus=incomplete\n")
        raise LabError("The final response did not end with end_turn.", EXIT_INCOMPLETE)

    second_content = _value(second_message, "content")
    if not isinstance(second_content, list):
        raise LabError("The final response content is malformed.", EXIT_PROTOCOL)
    normalized_second = [_block_to_dict(block) for block in second_content]
    if any(block.get("type") == "tool_use" for block in normalized_second):
        raise LabError("A second tool request was refused. No second lookup ran.", EXIT_PROTOCOL)
    final_text = "".join(
        block.get("text", "") for block in normalized_second if block.get("type") == "text"
    ).strip()
    if not final_text:
        output.write("\nstatus=incomplete\n")
        raise LabError("The final response contained no draft text.", EXIT_INCOMPLETE)

    output.write("\nprovider_calls=2\n")
    output.write("read_only_lookups=1\n")
    output.write("generation_status=completed_end_turn\n")
    output.write("draft_status=ready_for_human_source_review\n")
    output.write("business_status=not_accepted\n")
    output.flush()


def print_offline_plan(output: TextIO = sys.stdout) -> None:
    output.write("mode=offline\n")
    output.write("network_calls=0\n")
    output.write("tool_calls=0\n")
    output.write("account=northstar-freight\n")
    output.write("tool=lookup_northstar_account\n")
    output.write("Run with --live only after setting ANTHROPIC_API_KEY and ANTHROPIC_MODEL.\n")
    output.write("The API key belongs in the environment, not in this file or a command argument.\n")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stream a synthetic Northstar tool cycle through the Claude API."
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Make up to two provider calls and one local read-only synthetic lookup.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not args.live:
        print_offline_plan()
        return 0

    auth_token = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not auth_token:
        print("error=ANTHROPIC_API_KEY is required for --live", file=sys.stderr)
        return EXIT_CONFIG
    model = os.environ.get("ANTHROPIC_MODEL", "").strip()
    if not model:
        print("error=ANTHROPIC_MODEL is required for --live", file=sys.stderr)
        return EXIT_CONFIG

    try:
        from anthropic import Anthropic
    except ImportError:
        print(
            "error=Install the optional SDK from requirements-live.txt before --live",
            file=sys.stderr,
        )
        return EXIT_CONFIG

    client = build_sdk_client(auth_token, Anthropic)
    try:
        run_live(client, model)
    except LabError as exc:
        print(f"error={exc}", file=sys.stderr)
        return exc.exit_code
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
