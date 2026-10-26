from __future__ import annotations

import hashlib
import json
from typing import Any


REQUIRED_KEYS = {
    "synthetic",
    "account_id",
    "source_id",
    "source_ids",
    "notes",
    "access_checked",
    "actor_id",
}
EXPECTED_SOURCE_IDS = ["CRM", "CALL", "SUPPORT", "USAGE"]
ALLOWED_FIXTURE_IDS = {
    "baseline",
    "conflicting-date",
    "missing-sso",
    "untrusted-instruction",
}
MAX_NOTES_BYTES = 20_000


class ContractError(ValueError):
    pass


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def validate_record(record: Any) -> dict[str, Any]:
    if not isinstance(record, dict):
        raise ContractError("record must be a JSON object")
    keys = set(record)
    if keys != REQUIRED_KEYS:
        missing = sorted(REQUIRED_KEYS - keys)
        extra = sorted(keys - REQUIRED_KEYS)
        raise ContractError(f"record keys differ: missing={missing}, extra={extra}")
    if record["synthetic"] is not True:
        raise ContractError("record must be explicitly synthetic")
    if record["access_checked"] is not True:
        raise ContractError("record must be access checked")
    if record["account_id"] != "northstar-freight":
        raise ContractError("only the northstar-freight synthetic account is allowed")
    if record["actor_id"] != "demo-account-owner":
        raise ContractError("actor_id is not the allowed synthetic demo actor")
    if record["source_ids"] != EXPECTED_SOURCE_IDS:
        raise ContractError(f"source_ids must equal {EXPECTED_SOURCE_IDS}")
    source_id = record["source_id"]
    if not isinstance(source_id, str) or "#" not in source_id:
        raise ContractError("source_id must identify a source-fixtures.json entry")
    prefix, fixture_id = source_id.rsplit("#", 1)
    if (
        not prefix.endswith("source-fixtures.json")
        or fixture_id not in ALLOWED_FIXTURE_IDS
    ):
        raise ContractError("source_id is not an allowed synthetic fixture")
    notes = record["notes"]
    if not isinstance(notes, str) or not notes.strip():
        raise ContractError("notes must be a non-empty string")
    if len(notes.encode("utf-8")) > MAX_NOTES_BYTES:
        raise ContractError("notes exceed the bounded input limit")
    return dict(record)
