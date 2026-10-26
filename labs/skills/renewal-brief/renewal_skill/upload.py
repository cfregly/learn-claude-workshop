from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from .bundle import BUNDLE_NAME, bundle_manifest, default_skill_root, staged_bundle
from .io import utc_now, write_json_atomic
from .provider import (
    ProviderEndpointError,
    ambiguous_method_failure,
    request_id_from,
    require_official_base_url,
    verify_client_base_url,
)


CONFIRMATION = "CREATE_OR_VERSION_WORKSPACE_SKILL"


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
    if args.pin_file.exists():
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
                "schema_version": 1,
                "status": "SKILLS_METHOD_ERROR_NO_RETRY",
                "operation": operation,
                "bundle_sha256": manifest["bundle_sha256"],
                "bundle_files": manifest["files"],
                "sdk": {"package": "anthropic", "version": anthropic.__version__},
                "created_at": utc_now(),
                "retry_attempted": False,
                "raw_response_persisted": False,
            }
            failure.update(
                ambiguous_method_failure(
                    method_field="skills_method_invocations",
                    base_url=effective_base_url,
                    error=error,
                )
            )
            write_json_atomic(args.pin_file, failure)
            print(f"Skill upload method failed without retry. Receipt: {args.pin_file}")
            return 2

        if args.existing_skill_id:
            if getattr(result, "type", None) != "skill_version":
                raise RuntimeError("version upload did not return a SkillVersion")
            skill_id = getattr(result, "skill_id", None)
            version = getattr(result, "id", None)
            name = getattr(result, "name", None)
            if skill_id != args.existing_skill_id or name != BUNDLE_NAME:
                raise RuntimeError(
                    "Skill version response does not match the requested Skill"
                )
            source_type = "custom"
        else:
            if getattr(result, "type", None) != "skill":
                raise RuntimeError("upload did not return a Skill")
            skill_id = getattr(result, "id", None)
            version = getattr(result, "latest_version_id", None)
            source_type = _source_type(result)
            if source_type != "custom":
                raise RuntimeError(
                    "created Skill did not return custom source metadata"
                )

    if not isinstance(skill_id, str) or not skill_id.strip():
        raise RuntimeError("upload did not return a Skill ID")
    if not isinstance(version, str) or not version.strip():
        raise RuntimeError("upload did not return a Skill version ID")

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
            "request_id": request_id_from(result),
        },
        "uploaded_at": utc_now(),
        "provider_calls": 1,
        "skills_method_invocations": 1,
        "provider_response_received": True,
        "raw_response_persisted": False,
    }
    write_json_atomic(args.pin_file, pin)
    print(f"Pinned custom Skill {skill_id} at {version}")
    print(f"Bundle SHA-256: {manifest['bundle_sha256']}")
    print(f"Pin file: {args.pin_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
