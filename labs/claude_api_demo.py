#!/usr/bin/env python3
"""Run the Northstar Claude API demo offline, or make one explicit live call."""

from __future__ import annotations

import argparse
import json
import os
import sys
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

ACCOUNT_ACCESS = {
    "demo-account-owner": {"northstar-freight"},
    "demo-no-access": set(),
}

SYNTHETIC_SOURCE_STORE = {
    "northstar-freight": [
        "[CRM] Northstar Freight renews on January 31, 2027. Maya Chen is the account owner.",
        "[CALL, October 14] Devon Price asked whether SSO is available. The supplied records contain no entitlement answer. A 12 percent discount was discussed but not approved.",
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
    print("The workshop site never collects or stores those values.")


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
            if len(raw) > MAX_RESPONSE_BYTES:
                print("error=response_too_large", file=sys.stderr)
                return 1
            body = parse_json_bytes(raw)
            response_headers = response.headers
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
        return 1
    except (URLError, TimeoutError) as exc:
        print(f"network_error={exc}", file=sys.stderr)
        return 1
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"response_error={exc}", file=sys.stderr)
        return 1

    blocks = body.get("content") if isinstance(body.get("content"), list) else []
    text_blocks = [
        block["text"]
        for block in blocks
        if isinstance(block, dict)
        and block.get("type") == "text"
        and isinstance(block.get("text"), str)
    ]

    print("mode=live")
    print(f"typed_text_blocks={len(text_blocks)}")
    for index, block_text in enumerate(text_blocks, start=1):
        print(f"text_block_{index}={block_text}")
    print(f"stop_reason={body.get('stop_reason', 'unavailable')}")
    print(f"request_id={request_id_from(response_headers, body)}")
    usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
    print(f"token_usage={json.dumps(usage, sort_keys=True)}")
    return 0


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
            return 2

    try:
        payload, record_count = build_payload(args.caller, args.account_id, model)
    except AccessDenied as exc:
        print("records_selected=0")
        print(f"access_denied={exc}", file=sys.stderr)
        return 3

    print_boundaries(payload, record_count)
    if not args.live:
        print_dry_run_instructions()
        return 0
    return make_live_call(payload, api_key)


if __name__ == "__main__":
    raise SystemExit(main())
