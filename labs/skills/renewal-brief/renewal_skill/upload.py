from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

from .bundle import BUNDLE_NAME, bundle_manifest, default_skill_root, staged_bundle
from .io import utc_now, write_json_atomic, write_json_exclusive
from .provider import (
    ProviderEndpointError,
    require_official_base_url,
    verify_client_base_url,
)


CONFIRMATION = "CREATE_OR_VERSION_WORKSPACE_SKILL"


def _safe_token(value: Any) -> str | None:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,300}", value):
        return None
    if re.search(r"(?i)sk-ant-|bearer|api[_-]?key|authorization", value):
        return None
    return value


def _field(value: Any, name: str) -> Any:
    try:
        return value.get(name) if isinstance(value, dict) else getattr(value, name, None)
    except Exception:
        return None


def _safe_request_id(value: Any) -> str | None:
    return _safe_token(_field(value, "_request_id")) or _safe_token(
        _field(value, "request_id")
    )


def _returned_fields(value: Any) -> dict[str, str]:
    fields = {}
    for name in ("id", "skill_id", "latest_version_id", "name", "type"):
        safe = _safe_token(_field(value, name))
        if safe is not None:
            fields[name] = safe
    return fields


def _save_failure(path: Path, failure: dict[str, Any]) -> None:
    try:
        write_json_atomic(path, failure)
    except Exception:
        print("Recovery receipt update failed. The reserved pin path still blocks upload.")
        print("Safe recovery data: " + json.dumps(failure, sort_keys=True))
    print(f"Skill upload requires reconciliation without retry. Receipt: {path}")


def _source_type(value: Any) -> str | None:
    source = getattr(value, "source", None)
    if source is None:
        return None
    if isinstance(source, dict):
        return source.get("type")
    return getattr(source, "type", None)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload the allowlisted renewal-brief Skill bundle"
    )
    parser.add_argument("--skill-root", type=Path, default=default_skill_root())
    parser.add_argument("--pin-file", type=Path, required=True)
    parser.add_argument("--existing-skill-id")
    parser.add_argument("--display-name", default="Renewal Brief")
    parser.add_argument("--timeout-seconds", type=float, default=120.0)
    parser.add_argument("--confirm-upload", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.confirm_upload != CONFIRMATION:
        raise SystemExit(f"Refusing upload. Pass --confirm-upload {CONFIRMATION}")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY is not set")
    if os.path.lexists(args.pin_file):
        raise SystemExit(f"Refusing to overwrite pin file {args.pin_file}")
    if not 15 <= args.timeout_seconds <= 300:
        raise SystemExit("timeout must be between 15 and 300 seconds")

    manifest = bundle_manifest(args.skill_root)
    try:
        base_url = require_official_base_url()
    except ProviderEndpointError as error:
        raise SystemExit(str(error)) from error
    try:
        import anthropic
        from anthropic.lib import files_from_dir
    except ImportError as error:
        raise SystemExit("Install requirements-skills.txt before uploading") from error

    client = anthropic.Anthropic(
        base_url=base_url,
        max_retries=0,
        timeout=args.timeout_seconds,
    )
    try:
        effective_base_url = verify_client_base_url(client)
    except ProviderEndpointError as error:
        raise SystemExit(str(error)) from error
    operation = "create_version" if args.existing_skill_id else "create_skill"
    with staged_bundle(args.skill_root) as staged:
        request: dict[str, Any] = {"files": files_from_dir(staged)}
        recovery = {
            "schema_version": 1,
            "status": "SKILLS_UPLOAD_PENDING_RECONCILIATION",
            "operation": operation,
            "bundle_sha256": manifest["bundle_sha256"],
            "bundle_files": manifest["files"],
            "sdk": {"package": "anthropic", "version": anthropic.__version__},
            "provider": {"base_url": effective_base_url, "request_id": None},
            "created_at": utc_now(),
            "requires_reconciliation": True,
            "skills_method_invocations": None,
            "provider_calls": None,
            "provider_response_received": False,
            "provider_request_and_usage_state": "unconfirmed_pending_upload",
            "retry_attempted": False,
            "raw_response_persisted": False,
        }
        try:
            write_json_exclusive(args.pin_file, recovery)
        except FileExistsError as error:
            raise SystemExit(f"Refusing to overwrite pin file {args.pin_file}") from error
        except Exception as error:
            raise SystemExit("Pin path could not be reserved safely. No upload was started.") from error
        try:
            if args.existing_skill_id:
                result = client.skills.versions.create(
                    skill_id=args.existing_skill_id,
                    **request,
                )
            else:
                request["display_name"] = args.display_name
                result = client.skills.create(**request)
        except Exception as error:
            failure = {
                **recovery,
                "status": "SKILLS_METHOD_ERROR_NO_RETRY",
                "skills_method_invocations": 1,
                "provider_request_and_usage_state": "unknown_after_method_exception",
            }
            request_id = _safe_request_id(error)
            failure["provider"] = {
                "base_url": effective_base_url,
                "request_id": request_id,
            }
            failure["error"] = {
                "type": _safe_token(type(error).__name__) or "Error",
                "status_code": _field(error, "status_code")
                if type(_field(error, "status_code")) is int
                else None,
                "request_id": request_id,
            }
            _save_failure(args.pin_file, failure)
            return 2

        recovery = {
            **recovery,
            "provider_response_received": True,
            "provider_calls": 1,
            "skills_method_invocations": 1,
            "provider_request_and_usage_state": "response_received_pin_unconfirmed",
            "provider": {
                "base_url": effective_base_url,
                "request_id": _safe_request_id(result),
            },
            "returned_fields": _returned_fields(result),
        }
        try:
            write_json_atomic(args.pin_file, recovery)
        except Exception:
            _save_failure(
                args.pin_file,
                {**recovery, "status": "SKILLS_RECOVERY_WRITE_ERROR_NO_RETRY"},
            )
            return 2
        try:
            if args.existing_skill_id:
                if getattr(result, "type", None) != "skill_version":
                    raise ValueError("invalid response type")
                skill_id = getattr(result, "skill_id", None)
                version = getattr(result, "id", None)
                name = getattr(result, "name", None)
                if skill_id != args.existing_skill_id or name != BUNDLE_NAME:
                    raise ValueError("invalid version identity")
                source_type = "custom"
            else:
                if getattr(result, "type", None) != "skill":
                    raise ValueError("invalid response type")
                skill_id = getattr(result, "id", None)
                version = getattr(result, "latest_version_id", None)
                source_type = _source_type(result)
                if source_type != "custom":
                    raise ValueError("invalid source metadata")
            if not _safe_token(skill_id) or not _safe_token(version):
                raise ValueError("invalid pin identifiers")
        except Exception:
            _save_failure(
                args.pin_file,
                {**recovery, "status": "SKILLS_RESPONSE_INVALID_NO_RETRY"},
            )
            return 2

    pin = {
        "schema_version": 1,
        "skill_name": BUNDLE_NAME,
        "display_name_requested": args.display_name
        if operation == "create_skill"
        else None,
        "skill_id": skill_id,
        "version": version,
        "source_type": source_type,
        "operation": operation,
        "bundle_sha256": manifest["bundle_sha256"],
        "bundle_files": manifest["files"],
        "sdk": {"package": "anthropic", "version": anthropic.__version__},
        "api_surface": "GA Skills API",
        "provider": {
            "base_url": effective_base_url,
            "request_id": recovery["provider"]["request_id"],
        },
        "uploaded_at": utc_now(),
        "provider_calls": 1,
        "skills_method_invocations": 1,
        "provider_response_received": True,
        "raw_response_persisted": False,
    }
    try:
        write_json_atomic(args.pin_file, pin)
    except Exception:
        _save_failure(
            args.pin_file,
            {**recovery, "status": "SKILLS_PIN_WRITE_ERROR_NO_RETRY"},
        )
        return 2
    print(f"Pinned custom Skill {skill_id} at {version}")
    print(f"Bundle SHA-256: {manifest['bundle_sha256']}")
    print(f"Pin file: {args.pin_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
