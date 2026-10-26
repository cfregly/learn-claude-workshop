from __future__ import annotations

import os
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit


OFFICIAL_BASE_URL = "https://api.anthropic.com"


class ProviderEndpointError(ValueError):
    pass


def _is_official_endpoint(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        return bool(
            parsed.scheme == "https"
            and parsed.hostname == "api.anthropic.com"
            and parsed.port is None
            and parsed.username is None
            and parsed.password is None
            and parsed.path in ("", "/")
            and not parsed.query
            and not parsed.fragment
        )
    except ValueError:
        return False


def require_official_base_url(
    environment: Mapping[str, str] | None = None,
) -> str:
    values = os.environ if environment is None else environment
    override = values.get("ANTHROPIC_BASE_URL")
    if override and not _is_official_endpoint(override):
        raise ProviderEndpointError(
            "Refusing a non-official ANTHROPIC_BASE_URL override"
        )
    return OFFICIAL_BASE_URL


def verify_client_base_url(client: Any) -> str:
    effective = str(getattr(client, "base_url", ""))
    if not _is_official_endpoint(effective):
        raise ProviderEndpointError(
            "SDK client is not using the official Anthropic endpoint"
        )
    return OFFICIAL_BASE_URL


def request_id_from(value: Any) -> str | None:
    for attribute in ("_request_id", "request_id"):
        request_id = getattr(value, attribute, None)
        if isinstance(request_id, str) and request_id:
            return request_id
    return None


def safe_error(error: Exception) -> dict[str, Any]:
    message = str(error)
    message = re.sub(r"sk-ant-[A-Za-z0-9_-]+", "[REDACTED_API_KEY]", message)
    message = re.sub(r"(?i)Bearer\s+\S+", "Bearer [REDACTED]", message)
    return {
        "type": type(error).__name__,
        "status_code": getattr(error, "status_code", None),
        "request_id": request_id_from(error),
        "message": message[:1_000],
    }


def ambiguous_method_failure(
    *, method_field: str, base_url: str, error: Exception
) -> dict[str, Any]:
    return {
        method_field: 1,
        "provider_calls": None,
        "provider_request_and_usage_state": "unknown_after_method_exception",
        "provider": {
            "base_url": base_url,
            "request_id": request_id_from(error),
        },
        "error": safe_error(error),
    }
