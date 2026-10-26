from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from contract import canonical_json_bytes, sha256_json, validate_record
except ModuleNotFoundError:
    from scripts.contract import canonical_json_bytes, sha256_json, validate_record


SCHEMA_VERSION = 1
BUNDLE_MARKER = "renewal-brief-native-v1"
SECTION_RE = re.compile(r"\[([^\]]+)\]\s*")
DATE_RE = re.compile(
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b"
)


class BriefError(ValueError):
    pass


def _sections(notes: str) -> list[tuple[str, str]]:
    matches = list(SECTION_RE.finditer(notes))
    result: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(notes)
        result.append((match.group(1).strip(), notes[match.end() : end].strip()))
    if not result:
        raise BriefError("notes contain no labeled source sections")
    return result


def _first_section(sections: list[tuple[str, str]], prefix: str) -> str:
    for label, text in sections:
        if label.upper().startswith(prefix):
            return text
    raise BriefError(f"missing source section {prefix}")


def _iso_date(value: str) -> str:
    return datetime.strptime(value, "%B %d, %Y").date().isoformat()


def _extract_facts(
    record: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    sections = _sections(record["notes"])
    crm = _first_section(sections, "CRM")
    call = _first_section(sections, "CALL")
    support_label, support = next(
        (
            (label, text)
            for label, text in sections
            if label.upper().startswith("SUPPORT CASE")
        ),
        (None, None),
    )
    usage = _first_section(sections, "USAGE")
    if support_label is None or support is None:
        raise BriefError("missing support case section")

    owner_match = re.search(r"([A-Z][a-z]+\s+[A-Z][a-z]+) is the account owner", crm)
    if not owner_match:
        raise BriefError("account owner is missing")
    owner = owner_match.group(1)

    date_sources: list[dict[str, str]] = []
    for label, text in sections:
        if label.upper().startswith("CUSTOMER NOTE"):
            continue
        for value in DATE_RE.findall(text):
            if "renew" in text.lower():
                source = (
                    "CRM"
                    if label.upper().startswith("CRM")
                    else label.upper().replace(" ", "_")
                )
                date_sources.append({"date": _iso_date(value), "source_id": source})
    deduped_dates: list[str] = []
    for item in date_sources:
        if item["date"] not in deduped_dates:
            deduped_dates.append(item["date"])
    if not deduped_dates:
        raise BriefError("renewal date is missing")

    case_match = re.search(r"SUPPORT CASE\s+(\d+)", support_label, re.IGNORECASE)
    if not case_match:
        raise BriefError("support case number is missing")
    case_number = int(case_match.group(1))

    usage_match = re.search(
        r"Weekly active users are\s+(\d+),\s+down from\s+(\d+)",
        usage,
        re.IGNORECASE,
    )
    if not usage_match:
        raise BriefError("usage values are missing")
    weekly_active = int(usage_match.group(1))
    prior_weekly_active = int(usage_match.group(2))

    discount_match = re.search(
        r"(\d+) percent discount was discussed", call, re.IGNORECASE
    )
    if not discount_match:
        raise BriefError("discount discussion is missing")
    discount_percent = int(discount_match.group(1))
    discount_approved = any(
        label.upper().startswith("APPROVAL") for label, _ in sections
    )
    discount_approval_not_recorded = "approval is not recorded" in call.lower()

    if "SSO" not in call:
        sso_status = "not_in_source"
    elif "no entitlement information" in call:
        sso_status = "unknown"
    else:
        sso_status = "unresolved"

    facts = {
        "account_owner": owner,
        "renewal_dates": deduped_dates,
        "renewal_date_conflict": len(deduped_dates) > 1,
        "renewal_date_sources": date_sources,
        "sso_status": sso_status,
        "security_owner": "unknown" if "no owner is recorded" in call else "unresolved",
        "discount_percent_discussed": discount_percent,
        "discount_approved": discount_approved,
        "discount_approval_not_recorded": discount_approval_not_recorded,
        "open_support_case": case_number,
        "open_support_summary": support,
        "weekly_active_users": weekly_active,
        "prior_weekly_active_users": prior_weekly_active,
    }
    return facts, date_sources


def build_brief(record: dict[str, Any]) -> dict[str, Any]:
    record = validate_record(record)
    facts, date_sources = _extract_facts(record)
    confirmed: list[dict[str, Any]] = [
        {"text": f"Account owner: {facts['account_owner']}.", "source_ids": ["CRM"]},
        {
            "text": f"Open support case: {facts['open_support_case']}.",
            "source_ids": ["SUPPORT"],
        },
        {
            "text": (
                f"Weekly active users: {facts['weekly_active_users']}, previously "
                f"{facts['prior_weekly_active_users']}."
            ),
            "source_ids": ["USAGE"],
        },
    ]
    if facts["renewal_date_conflict"]:
        confirmed.append(
            {
                "text": "The records contain conflicting renewal dates: "
                + ", ".join(facts["renewal_dates"])
                + ".",
                "source_ids": sorted({item["source_id"] for item in date_sources}),
            }
        )
    else:
        confirmed.append(
            {
                "text": f"Renewal date: {facts['renewal_dates'][0]}.",
                "source_ids": ["CRM"],
            }
        )

    interpretation = [
        {
            "text": (
                f"Weekly active users decreased by "
                f"{facts['prior_weekly_active_users'] - facts['weekly_active_users']}. "
                "The records do not establish the cause."
            ),
            "source_ids": ["USAGE"],
        }
    ]
    open_questions: list[dict[str, Any]] = [
        {
            "text": (
                f"Is the {facts['discount_percent_discussed']} percent discount approved? "
                + (
                    "An APPROVAL section is present, which this fixture renderer rejects."
                    if facts["discount_approved"]
                    else (
                        "The CALL section says approval is not recorded."
                        if facts["discount_approval_not_recorded"]
                        else "The CALL section does not state the approval status."
                    )
                )
            ),
            "source_ids": ["CALL"],
        },
        {"text": "Who owns the security follow-up?", "source_ids": ["CALL"]},
        {
            "text": (
                "What is the customer's SSO entitlement?"
                if facts["sso_status"] != "not_in_source"
                else "Is SSO relevant to this renewal? It is not in the provided source."
            ),
            "source_ids": ["CALL"],
        },
    ]
    if facts["renewal_date_conflict"]:
        open_questions.insert(
            0,
            {
                "text": "Which renewal date is authoritative?",
                "source_ids": sorted({item["source_id"] for item in date_sources}),
            },
        )

    actions: list[dict[str, Any]] = [
        {
            "owner": facts["account_owner"],
            "text": f"Confirm the status and customer impact of support case {facts['open_support_case']}.",
            "source_ids": ["CRM", "SUPPORT"],
            "status": "proposed",
        },
        {
            "owner": "needs assignment",
            "text": "Assign and complete the security follow-up.",
            "source_ids": ["CALL"],
            "status": "proposed",
        },
        {
            "owner": facts["account_owner"],
            "text": "Confirm discount approval before making a customer commitment.",
            "source_ids": ["CRM", "CALL"],
            "status": "proposed",
        },
    ]
    if facts["renewal_date_conflict"]:
        actions.insert(
            0,
            {
                "owner": facts["account_owner"],
                "text": "Resolve the conflicting renewal dates before a customer-facing commitment.",
                "source_ids": sorted({item["source_id"] for item in date_sources}),
                "status": "proposed",
            },
        )

    result = {
        "schema_version": SCHEMA_VERSION,
        "synthetic": True,
        "account_id": record["account_id"],
        "source_id": record["source_id"],
        "source_ids": record["source_ids"],
        "provenance": {
            "origin": "caller_supplied_synthetic_record",
            "record_declarations": {
                "synthetic": record["synthetic"],
                "access_checked": record["access_checked"],
                "actor_id": record["actor_id"],
            },
            "source_ids_are_embedded_labels": True,
            "external_source_reads_performed": False,
            "authorization_authentication_proven": False,
        },
        "facts": facts,
        "brief": {
            "confirmed_facts": confirmed,
            "interpretation": interpretation,
            "open_questions": open_questions,
            "proposed_next_actions": actions,
        },
        "limitations": [
            "Synthetic teaching record only.",
            "No live CRM access or external write occurred.",
            "Record declarations do not prove authorization or authentication.",
            "Source IDs are embedded labels, not external reads.",
            "All proposed actions require human review.",
        ],
    }
    validate_brief(result)
    return result


def validate_brief(brief: dict[str, Any]) -> None:
    if (
        brief.get("schema_version") != SCHEMA_VERSION
        or brief.get("synthetic") is not True
    ):
        raise BriefError("brief schema or synthetic marker is invalid")
    facts = brief.get("facts")
    if not isinstance(facts, dict):
        raise BriefError("facts are missing")
    if facts.get("discount_approved") is not False:
        raise BriefError("discount approval is unsupported")
    if not facts.get("renewal_dates"):
        raise BriefError("renewal dates are missing")
    sections = brief.get("brief")
    if not isinstance(sections, dict):
        raise BriefError("brief sections are missing")
    required_sections = {
        "confirmed_facts",
        "interpretation",
        "open_questions",
        "proposed_next_actions",
    }
    if set(sections) != required_sections:
        raise BriefError("brief sections differ from the contract")
    for section_name, entries in sections.items():
        if not isinstance(entries, list) or not entries:
            raise BriefError(f"section {section_name} must be non-empty")
        for entry in entries:
            if not isinstance(entry, dict) or not entry.get("source_ids"):
                raise BriefError(f"section {section_name} contains an unsourced entry")
    for action in sections["proposed_next_actions"]:
        if action.get("status") != "proposed":
            raise BriefError("an action was presented as completed")


def render(record: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    record = validate_record(record)
    brief = build_brief(record)
    marker = {
        "marker": BUNDLE_MARKER,
        "script": "scripts/render_brief.py",
        "source_id": record["source_id"],
        "input_sha256": sha256_json(record),
        "output_sha256": sha256_json(brief),
    }
    return brief, marker


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render a deterministic synthetic renewal brief"
    )
    parser.add_argument("--records-file", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    record = json.loads(args.records_file.read_text(encoding="utf-8"))
    brief, marker = render(record)
    output_text = json.dumps(
        brief, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(canonical_json_bytes(brief) + b"\n")
    print(
        "RENEWAL_BRIEF_SKILL_USED "
        + json.dumps(marker, sort_keys=True, separators=(",", ":"))
    )
    print("RENEWAL_BRIEF_OUTPUT " + output_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
