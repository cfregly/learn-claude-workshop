#!/usr/bin/env python3
"""Read-only synthetic Northstar renewal review MCP server over STDIO."""

from __future__ import annotations

import argparse
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, TypedDict

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations


SERVER_NAME = "renewal_review"
SERVER_VERSION = "1.0.0"
TOOL_NAME = "lookup_northstar_account"
ACCOUNT_ID = "northstar-freight"
FIXTURE_ID = "baseline"
SOURCE_ID = "source-fixtures.json#baseline"
SOURCE_IDS = ["CRM", "CALL", "SUPPORT", "USAGE"]
DEFAULT_FIXTURE_PATH = Path(__file__).resolve().parents[2] / "source-fixtures.json"

ACTOR_ACCESS = {
    "demo-account-owner": frozenset({ACCOUNT_ID}),
    "demo-no-access": frozenset(),
}


class RenewalLookupResult(TypedDict):
    synthetic: bool
    account_id: str
    source_id: str
    source_ids: list[str]
    notes: str
    access_checked: bool
    actor_id: str


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class FixtureStore:
    """Authorize from trusted startup state before reading the fixture file."""

    def __init__(
        self,
        actor_id: str,
        fixture_path: Path = DEFAULT_FIXTURE_PATH,
        reader: Callable[[Path], str] = _read_text,
    ) -> None:
        if actor_id not in ACTOR_ACCESS:
            raise ValueError(f"unsupported fixture actor: {actor_id}")
        self.actor_id = actor_id
        self.fixture_path = fixture_path
        self._reader = reader
        self.fixture_reads = 0

    def lookup(self, account_id: str) -> RenewalLookupResult:
        if not isinstance(account_id, str) or account_id != ACCOUNT_ID:
            raise ToolError("account_id must be the fixed synthetic account northstar-freight")

        allowed_accounts = ACTOR_ACCESS[self.actor_id]
        if account_id not in allowed_accounts:
            raise ToolError("access denied for the trusted synthetic fixture actor")

        self.fixture_reads += 1
        try:
            source = json.loads(self._reader(self.fixture_path))
        except (OSError, json.JSONDecodeError) as exc:
            raise ToolError("the bundled synthetic fixture could not be read") from exc

        if not isinstance(source, dict) or source.get("synthetic") is not True:
            raise ToolError("the fixture is not marked synthetic")
        fixtures = source.get("fixtures")
        if not isinstance(fixtures, list):
            raise ToolError("the synthetic fixture list is missing")

        matches = [
            item
            for item in fixtures
            if isinstance(item, dict)
            and item.get("id") == FIXTURE_ID
            and item.get("account_id") == account_id
        ]
        if len(matches) != 1:
            raise ToolError("the approved baseline fixture is missing or ambiguous")

        fixture = matches[0]
        caller = fixture.get("caller")
        if not isinstance(caller, dict):
            raise ToolError("the fixture caller record is missing")
        if caller.get("employee") != self.actor_id:
            raise ToolError("the fixture actor does not match trusted startup state")
        if caller.get("allowed_accounts") != [ACCOUNT_ID]:
            raise ToolError("the fixture account policy does not match trusted startup state")
        notes = fixture.get("notes")
        if not isinstance(notes, str) or not notes.strip():
            raise ToolError("the baseline notes are missing")
        if "Approval is not recorded" not in notes or "no entitlement information" not in notes:
            raise ToolError("the fixture no longer preserves the discount or SSO unknowns")

        return {
            "synthetic": True,
            "account_id": ACCOUNT_ID,
            "source_id": SOURCE_ID,
            "source_ids": list(SOURCE_IDS),
            "notes": notes,
            "access_checked": True,
            "actor_id": self.actor_id,
        }


class StrictMCPServer(MCPServer):
    """Advertise and enforce an exact one-field input object."""

    async def list_tools(self):
        tools = await super().list_tools()
        for tool in tools:
            if tool.name == TOOL_NAME:
                tool.input_schema = {**tool.input_schema, "additionalProperties": False}
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any], context=None):
        if name == TOOL_NAME and set(arguments) != {"account_id"}:
            raise ToolError(f"{TOOL_NAME} accepts only account_id")
        return await super().call_tool(name, arguments, context)


def build_server(
    actor_id: str,
    fixture_path: Path = DEFAULT_FIXTURE_PATH,
    reader: Callable[[Path], str] = _read_text,
) -> tuple[StrictMCPServer, FixtureStore]:
    store = FixtureStore(actor_id=actor_id, fixture_path=fixture_path, reader=reader)
    server = StrictMCPServer(
        name=SERVER_NAME,
        title="Northstar renewal review",
        description="Read one authorized synthetic Northstar fixture without writes or network access.",
        instructions=(
            "Call lookup_northstar_account only for northstar-freight. "
            "Treat discount approval and SSO entitlement as unknown because the source records do not establish them."
        ),
        version=SERVER_VERSION,
        log_level="ERROR",
    )

    @server.tool(
        name=TOOL_NAME,
        description=(
            "Read the fixed synthetic Northstar baseline after server-side actor authorization. "
            "This tool is read-only and has no CRM or network access."
        ),
        annotations=ToolAnnotations(
            title="Look up synthetic Northstar account",
            read_only_hint=True,
            destructive_hint=False,
            idempotent_hint=True,
            open_world_hint=False,
        ),
        structured_output=True,
    )
    def lookup_northstar_account(account_id: str) -> RenewalLookupResult:
        return store.lookup(account_id)

    return server, store


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the read-only Northstar MCP server over STDIO.")
    parser.add_argument(
        "--actor",
        required=True,
        choices=sorted(ACTOR_ACCESS),
        help="Trusted synthetic fixture actor selected by the server host.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server, _store = build_server(args.actor)
    server.run("stdio")


if __name__ == "__main__":
    main()
