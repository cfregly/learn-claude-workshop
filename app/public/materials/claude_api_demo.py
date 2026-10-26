#!/usr/bin/env python3
"""Run the Northstar Claude API demo offline, or make one explicit live call."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2026-10-21"
MAX_TOKENS = 350
TIMEOUT_SECONDS = 30
MAX_RESPONSE_BYTES = 1_000_000
DEFAULT_CALLER = "demo-account-owner"
DEFAULT_ACCOUNT_ID = "northstar-freight"
EXIT_RESPONSE_ERROR = 1
EXIT_LIVE_ENV_REQUIRED = 2
EXIT_ACCESS_DENIED = 3
EXIT_INCOMPLETE_GENERATION = 4
EXIT_REFUSAL = 5
EXIT_EMPTY_DRAFT = 6
EXIT_UNEXPECTED_CONTINUATION = 7
EXIT_UNEXPECTED_STOP = 8

ACCOUNT_ACCESS = {
    "demo-account-owner": {"northstar-freight"},
    "demo-no-access": set(),
}

SYNTHETIC_SOURCE_STORE = {
    "northstar-freight": [
        "[CRM] Northstar Freight renews on January 31, 2027. Maya Chen is the account owner.",
        "[CALL, October 14] Devon Price asked whether SSO is available. The supplied records contain no entitlement answer. A 12 percent discount was discussed. Approval is not recorded.",
        "[SUPPORT CASE 4821] Delayed shipment-alert emails remain open.",
        "[USAGE] Weekly active users are 64, down from 78 in the prior period.",
    ]
}

SYSTEM_INSTRUCTIONS = (
    "Use only the supplied synthetic records. Separate confirmed facts, synthesis, "
    "and unknowns. Preserve source labels. Do not say the discount is approved. "
    "Return a concise internal draft for human review."
)


class AccessDenied(RuntimeError):
    """Raised before account facts are selected."""


@dataclass(frozen=True)
class ResponseClassification:
    """Pure classification of one successful Messages API response body."""

    stop_reason: str
    text_blocks: tuple[str, ...]
    generation_status: str
    generation_terminal: str
    draft_status: str
    business_status: str
    exit_code: int
    detail: str


def check_account_access(caller: str, account_id: str) -> None:
    """Authorize the application caller before reading account records."""
    if account_id not in ACCOUNT_ACCESS.get(caller, set()):
        raise AccessDenied(f"caller {caller!r} cannot read account {account_id!r}")


def get_approved_context(account_id: str) -> list[str]:
    """Return the approved synthetic records after the caller check."""
    return list(SYNTHETIC_SOURCE_STORE[account_id])


def build_payload(caller: str, account_id: str, model: str) -> tuple[dict[str, Any], int]:
    """Check access first, then attach the approved account facts."""
    check_account_access(caller, account_id)
    records = get_approved_context(account_id)
    context = "\n".join(records)
    payload = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_INSTRUCTIONS,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Prepare the reviewed renewal brief.\n\n{context}",
                    }
                ],
            }
        ],
    }
    return payload, len(records)


def print_boundaries(payload: dict[str, Any], record_count: int) -> None:
    """Print small nonsecret boundary counts before any instructions or output."""
    user_blocks = payload["messages"][0]["content"]
    context_chars = sum(len(block.get("text", "")) for block in user_blocks)
    print(f"records_selected={record_count}")
    print(f"request_content_blocks={len(user_blocks)}")
    print(f"request_text_characters={context_chars}")
    print(f"max_tokens={MAX_TOKENS}")
    print(f"timeout_seconds={TIMEOUT_SECONDS}")


def print_dry_run_instructions() -> None:
    print("mode=offline_dry_run")
    print("network_request=not_made")
    print("The application access check passed before synthetic account facts were attached.")
    print("Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL in your own environment, then add --live for one direct API call.")
    print("This local client does not send your environment values to the workshop site.")


def request_id_from(headers: Any, body: dict[str, Any] | None = None) -> str:
    header_value = headers.get("request-id") if headers else None
    if header_value:
        return str(header_value)
    if body and body.get("request_id"):
        return str(body["request_id"])
    return "unavailable"


def parse_json_bytes(raw: bytes) -> dict[str, Any]:
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("API response must be a JSON object")
    return parsed


def classify_response(body: dict[str, Any]) -> ResponseClassification:
    """Classify generation separately from transport, review, and acceptance."""
    stop_reason_value = body.get("stop_reason")
    stop_reason = stop_reason_value if isinstance(stop_reason_value, str) else "unavailable"
    content = body.get("content")
    text_blocks: list[str] = []
    block_types: list[str] = []

    if not isinstance(content, list):
        return ResponseClassification(
            stop_reason,
            (),
            "malformed_response",
            "unknown",
            "not_ready",
            "not_accepted",
            EXIT_RESPONSE_ERROR,
            "The response content field is not a typed block list.",
        )

    for block in content:
        if not isinstance(block, dict) or not isinstance(block.get("type"), str):
            return ResponseClassification(
                stop_reason,
                tuple(text_blocks),
                "malformed_response",
                "unknown",
                "not_ready",
                "not_accepted",
                EXIT_RESPONSE_ERROR,
                "The response contains a malformed content block.",
            )
        block_type = block["type"]
        block_types.append(block_type)
        if block_type == "text":
            if not isinstance(block.get("text"), str):
                return ResponseClassification(
                    stop_reason,
                    tuple(text_blocks),
                    "malformed_response",
                    "unknown",
                    "not_ready",
                    "not_accepted",
                    EXIT_RESPONSE_ERROR,
                    "A text block does not contain string text.",
                )
            text_blocks.append(block["text"])

    has_visible_text = any(text.strip() for text in text_blocks)
    continuation_blocks = {"tool_use", "server_tool_use", "mcp_tool_use"}
    has_continuation_block = any(block_type in continuation_blocks for block_type in block_types)

    if stop_reason == "end_turn" and has_continuation_block:
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            "unexpected_continuation",
            "no",
            "not_ready",
            "not_accepted",
            EXIT_UNEXPECTED_CONTINUATION,
            "The text-only request returned an unexpected tool continuation block. No tool was run.",
        )
    if stop_reason == "end_turn" and has_visible_text:
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            "completed_end_turn",
            "yes",
            "ready_for_human_review",
            "not_accepted",
            0,
            "The generation ended naturally with typed text. Human review is still required.",
        )
    if stop_reason == "end_turn":
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            "completed_end_turn_empty",
            "yes",
            "not_ready",
            "not_accepted",
            EXIT_EMPTY_DRAFT,
            "The generation ended naturally but returned no visible typed text.",
        )
    if stop_reason in {"max_tokens", "model_context_window_exceeded"}:
        reason = "the output token limit" if stop_reason == "max_tokens" else "the model context window"
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            f"incomplete_{stop_reason}",
            "no",
            "not_ready",
            "not_accepted",
            EXIT_INCOMPLETE_GENERATION,
            f"The response stopped at {reason}. Preserve any typed text only as partial output.",
        )
    if stop_reason == "refusal":
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            "refused",
            "yes",
            "not_ready",
            "not_accepted",
            EXIT_REFUSAL,
            "The request completed with a refusal. No draft is ready for use.",
        )
    if stop_reason in {"tool_use", "pause_turn"}:
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            "unexpected_continuation",
            "no",
            "not_ready",
            "not_accepted",
            EXIT_UNEXPECTED_CONTINUATION,
            f"The text-only request unexpectedly returned {stop_reason}. This client does not continue or run tools automatically.",
        )
    if stop_reason == "stop_sequence":
        return ResponseClassification(
            stop_reason,
            tuple(text_blocks),
            "unexpected_stop_sequence",
            "no",
            "not_ready",
            "not_accepted",
            EXIT_UNEXPECTED_STOP,
            "The response reports stop_sequence even though this request defines no stop sequences.",
        )
    return ResponseClassification(
        stop_reason,
        tuple(text_blocks),
        "unexpected_stop_reason",
        "unknown",
        "not_ready",
        "not_accepted",
        EXIT_UNEXPECTED_STOP,
        "The response has an unavailable or unsupported stop reason.",
    )


def make_live_call(payload: dict[str, Any], api_key: str) -> int:
    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "anthropic-version": API_VERSION,
            "content-type": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            response_headers = response.headers
            response_status = getattr(response, "status", 200)
            if len(raw) > MAX_RESPONSE_BYTES:
                print("mode=live")
                print(f"http_status={response_status}")
                print("http_transport_status=completed")
                print("error=response_too_large", file=sys.stderr)
                print(f"request_id={request_id_from(response_headers)}")
                return EXIT_RESPONSE_ERROR
            body = parse_json_bytes(raw)
    except HTTPError as exc:
        raw = exc.read(MAX_RESPONSE_BYTES)
        try:
            body = parse_json_bytes(raw)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            body = {}
        error = body.get("error") if isinstance(body.get("error"), dict) else {}
        print(f"http_status={exc.code}", file=sys.stderr)
        print(f"error_type={error.get('type', 'unknown')}", file=sys.stderr)
        print(f"error_message={error.get('message', exc.reason)}", file=sys.stderr)
        print(f"request_id={request_id_from(exc.headers, body)}", file=sys.stderr)
        print("http_transport_status=http_error", file=sys.stderr)
        return EXIT_RESPONSE_ERROR
    except (URLError, TimeoutError) as exc:
        print(f"network_error={exc}", file=sys.stderr)
        print("http_transport_status=transport_error", file=sys.stderr)
        return EXIT_RESPONSE_ERROR
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        print("http_transport_status=completed", file=sys.stderr)
        print(f"response_error={exc}", file=sys.stderr)
        return EXIT_RESPONSE_ERROR

    classification = classify_response(body)

    print("mode=live")
    print(f"http_status={response_status}")
    print("http_transport_status=completed")
    print(f"typed_text_blocks={len(classification.text_blocks)}")
    for index, block_text in enumerate(classification.text_blocks, start=1):
        print(f"text_block_{index}={block_text}")
    print(f"stop_reason={classification.stop_reason}")
    print(f"request_id={request_id_from(response_headers, body)}")
    usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
    print(f"token_usage={json.dumps(usage, sort_keys=True)}")
    print(f"generation_status={classification.generation_status}")
    print(f"generation_terminal={classification.generation_terminal}")
    print(f"draft_status={classification.draft_status}")
    print(f"business_status={classification.business_status}")
    print(f"classification_detail={classification.detail}")
    return classification.exit_code


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare the synthetic Northstar request offline by default. "
            "Use --live only from your own environment to make one direct Claude API call."
        )
    )
    parser.add_argument("--live", action="store_true", help="Make one direct API call after the application access check")
    parser.add_argument("--caller", default=DEFAULT_CALLER, choices=sorted(ACCOUNT_ACCESS), help="Synthetic application caller")
    parser.add_argument("--account-id", default=DEFAULT_ACCOUNT_ID, choices=sorted(SYNTHETIC_SOURCE_STORE), help="Synthetic account ID")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    model = "model-from-ANTHROPIC_MODEL"
    api_key = ""

    if args.live:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        model = os.environ.get("ANTHROPIC_MODEL", "")
        if not api_key or not model:
            print("error=--live requires ANTHROPIC_API_KEY and ANTHROPIC_MODEL in the learner environment", file=sys.stderr)
            return EXIT_LIVE_ENV_REQUIRED

    try:
        payload, record_count = build_payload(args.caller, args.account_id, model)
    except AccessDenied as exc:
        print("records_selected=0")
        print(f"access_denied={exc}", file=sys.stderr)
        return EXIT_ACCESS_DENIED

    print_boundaries(payload, record_count)
    if not args.live:
        print_dry_run_instructions()
        return 0
    return make_live_call(payload, api_key)


if __name__ == "__main__":
    raise SystemExit(main())
