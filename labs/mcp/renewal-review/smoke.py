#!/usr/bin/env python3
"""Bounded STDIO lifecycle smoke and synthetic result exporter."""

from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import importlib.util
import json
import sys
import tempfile
from pathlib import Path
from types import ModuleType
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


HERE = Path(__file__).resolve().parent
SERVER_PATH = HERE / "server.py"


def load_server_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("renewal_review_server", SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load renewal review server")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


async def exercise_stdio(python: str, actor: str) -> tuple[dict[str, Any], str]:
    parameters = StdioServerParameters(
        command=python,
        args=[str(SERVER_PATH), "--actor", actor],
        cwd=HERE,
    )
    with tempfile.TemporaryFile(mode="w+") as server_stderr:
        try:
            async with stdio_client(parameters, errlog=server_stderr) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    initialized = await session.initialize()
                    tools = await session.list_tools()
                    require(initialized.server_info.name == "renewal_review", "unexpected MCP server name")
                    require(len(tools.tools) == 1, "server must expose exactly one tool")
                    tool = tools.tools[0]
                    require(tool.name == "lookup_northstar_account", "unexpected tool name")
                    require(
                        set(tool.input_schema.get("properties", {})) == {"account_id"},
                        "actor or another field leaked into the tool schema",
                    )
                    require(tool.input_schema.get("additionalProperties") is False, "tool schema must reject extra input")
                    require(
                        tool.annotations is not None and tool.annotations.read_only_hint is True,
                        "tool must be read-only",
                    )

                    result = await session.call_tool(
                        "lookup_northstar_account",
                        {"account_id": "northstar-freight"},
                    )
                    if actor == "demo-account-owner":
                        require(result.is_error is False, "authorized lookup failed")
                        require(isinstance(result.structured_content, dict), "authorized result is not structured JSON")
                        allowed_result = dict(result.structured_content)

                        extra = await session.call_tool(
                            "lookup_northstar_account",
                            {"account_id": "northstar-freight", "actor_id": "demo-account-owner"},
                        )
                        require(extra.is_error is True, "extra tool input was accepted")

                        wrong_account = await session.call_tool(
                            "lookup_northstar_account",
                            {"account_id": "another-account"},
                        )
                        require(wrong_account.is_error is True, "unexpected account was accepted")

                        unknown = await session.call_tool("unknown_tool", {})
                        require(unknown.is_error is True, "unknown tool was accepted")
                        write = await session.call_tool(
                            "update_northstar_account",
                            {"account_id": "northstar-freight"},
                        )
                        require(write.is_error is True, "write tool was accepted")
                    else:
                        require(result.is_error is True, "denied actor unexpectedly read the fixture")
                        allowed_result = {}

                    initialization = {
                        "server_name": initialized.server_info.name,
                        "server_version": initialized.server_info.version,
                        "protocol_version": initialized.protocol_version,
                        "tool_count": len(tools.tools),
                    }
        except BaseException:
            server_stderr.seek(0)
            print(server_stderr.read(), file=sys.stderr, end="")
            raise

        server_stderr.seek(0)
        stderr_text = server_stderr.read()
    return {"initialization": initialization, "result": allowed_result}, stderr_text


async def run_smoke(python: str) -> dict[str, Any]:
    module = load_server_module()
    reads = 0

    def forbidden_reader(_path: Path) -> str:
        nonlocal reads
        reads += 1
        raise AssertionError("fixture reader ran for denied actor")

    denied_store = module.FixtureStore("demo-no-access", reader=forbidden_reader)
    try:
        denied_store.lookup("northstar-freight")
    except module.ToolError:
        pass
    else:
        raise AssertionError("denied in-process lookup did not fail")
    require(reads == 0 and denied_store.fixture_reads == 0, "denied actor read the fixture")

    owner, owner_stderr = await exercise_stdio(python, "demo-account-owner")
    denied, denied_stderr = await exercise_stdio(python, "demo-no-access")
    result = owner["result"]
    expected_keys = {
        "synthetic",
        "account_id",
        "source_id",
        "source_ids",
        "notes",
        "access_checked",
        "actor_id",
    }
    require(set(result) == expected_keys, "allowed result contract changed")
    require(result["synthetic"] is True, "synthetic marker missing")
    require(result["account_id"] == "northstar-freight", "account ID changed")
    require(result["source_id"] == "source-fixtures.json#baseline", "source ID changed")
    require(result["source_ids"] == ["CRM", "CALL", "SUPPORT", "USAGE"], "source IDs changed")
    require(result["access_checked"] is True, "access check marker missing")
    require(result["actor_id"] == "demo-account-owner", "trusted actor ID changed")
    require("Approval is not recorded" in result["notes"], "discount unknown was lost")
    require("no entitlement information" in result["notes"], "SSO unknown was lost")

    parse_error_marker = "Failed to parse JSONRPC message from server"
    require(parse_error_marker not in owner_stderr + denied_stderr, "server wrote non-JSON-RPC data to stdout")

    return {
        "status": "passed",
        "sdk": {"package": "mcp", "version": importlib.metadata.version("mcp")},
        "initialization": owner["initialization"],
        "checks": {
            "initialize": True,
            "list_tools": True,
            "successful_read": True,
            "denied_before_fixture_read": True,
            "extra_input_rejected": True,
            "unexpected_account_rejected": True,
            "unknown_tool_rejected": True,
            "write_tool_rejected": True,
            "orderly_stdio_shutdown": True,
            "stdout_json_rpc_only": True,
            "discount_unknown_preserved": True,
            "sso_unknown_preserved": True,
        },
        "allowed_result": result,
        "denied_initialization": denied["initialization"],
        "limits": {
            "transport": "stdio",
            "tools": ["lookup_northstar_account"],
            "accounts": ["northstar-freight"],
            "actors": ["demo-account-owner", "demo-no-access"],
            "network_calls": 0,
            "model_calls": 0,
            "write_tools": 0,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke the renewal review MCP server over STDIO.")
    parser.add_argument("--python", default=sys.executable, help="Python executable with requirements-mcp.txt installed.")
    parser.add_argument("--export", type=Path, help="Write the allowed synthetic tool result for the Skill runner.")
    parser.add_argument("--receipt", type=Path, help="Write the complete smoke receipt as JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    receipt = asyncio.run(run_smoke(str(Path(args.python).absolute())))
    if args.export:
        args.export.parent.mkdir(parents=True, exist_ok=True)
        args.export.write_text(json.dumps(receipt["allowed_result"], indent=2) + "\n", encoding="utf-8")
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
