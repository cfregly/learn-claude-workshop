#!/usr/bin/env python3
"""Bounded STDIO lifecycle smoke and synthetic result exporter."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.metadata
import importlib.util
import json
import platform
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


HERE = Path(__file__).resolve().parent
SERVER_PATH = HERE / "server.py"
SMOKE_PATH = Path(__file__).resolve()
TEST_PATH = HERE / "test_server.py"
README_PATH = HERE / "README.md"
FIXTURE_PATH = HERE.parents[1] / "source-fixtures.json"


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


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def validate_json_rpc_stdout(stdout: str) -> list[dict[str, Any]]:
    lines = [line for line in stdout.splitlines() if line.strip()]
    require(bool(lines), "server stdout probe returned no JSON-RPC messages")
    messages: list[dict[str, Any]] = []
    for index, line in enumerate(lines, start=1):
        try:
            message = json.loads(line)
        except json.JSONDecodeError as error:
            raise AssertionError(f"server stdout line {index} is not JSON") from error
        require(isinstance(message, dict), f"server stdout line {index} is not a JSON object")
        require(message.get("jsonrpc") == "2.0", f"server stdout line {index} is not JSON-RPC 2.0")
        has_method = isinstance(message.get("method"), str)
        has_response = "id" in message and (("result" in message) != ("error" in message))
        require(has_method or has_response, f"server stdout line {index} has no JSON-RPC message shape")
        messages.append(message)
    return messages


def probe_server_stdout(python: str) -> dict[str, Any]:
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "renewal-review-stdout-probe", "version": "1.0.0"},
        },
    }
    completed = subprocess.run(
        [python, str(SERVER_PATH), "--actor", "demo-account-owner"],
        input=json.dumps(request, separators=(",", ":")) + "\n",
        text=True,
        capture_output=True,
        cwd=HERE,
        timeout=10,
        check=False,
    )
    require(completed.returncode == 0, "server stdout probe did not exit cleanly after input EOF")
    messages = validate_json_rpc_stdout(completed.stdout)
    response = next((message for message in messages if message.get("id") == 1), None)
    require(response is not None and "result" in response, "server stdout probe has no initialize result")
    result = response["result"]
    require(isinstance(result, dict), "initialize probe result is not an object")
    return {
        "scope": "one initialize request followed by input EOF",
        "captured_nonempty_stdout_lines": len(messages),
        "all_captured_stdout_lines_valid_json_rpc_2_0": True,
        "server_process_return_code_after_eof": completed.returncode,
        "protocol_version": result.get("protocolVersion"),
        "server_stderr_present": bool(completed.stderr),
    }


async def exercise_stdio(python: str, actor: str) -> dict[str, Any]:
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

        context_exit_clean = True
        server_stderr.seek(0)
        stderr_present = bool(server_stderr.read())
    return {
        "initialization": initialization,
        "result": allowed_result,
        "context_exit_clean": context_exit_clean,
        "server_stderr_present": stderr_present,
    }


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

    stdout_probe = probe_server_stdout(python)
    owner = await exercise_stdio(python, "demo-account-owner")
    denied = await exercise_stdio(python, "demo-no-access")
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

    require(owner["context_exit_clean"] is True, "owner STDIO transport context did not exit cleanly")
    require(denied["context_exit_clean"] is True, "denied STDIO transport context did not exit cleanly")

    source_hashes = {
        "labs/mcp/renewal-review/server.py": sha256_file(SERVER_PATH),
        "labs/mcp/renewal-review/smoke.py": sha256_file(SMOKE_PATH),
        "labs/mcp/renewal-review/test_server.py": sha256_file(TEST_PATH),
        "labs/mcp/renewal-review/README.md": sha256_file(README_PATH),
        "labs/source-fixtures.json": sha256_file(FIXTURE_PATH),
    }

    return {
        "receipt_kind": "sanitized_observed_local_smoke",
        "created_at": utc_now(),
        "status": "passed",
        "sdk": {"package": "mcp", "version": importlib.metadata.version("mcp")},
        "python_version": platform.python_version(),
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
        },
        "server_sha256": source_hashes["labs/mcp/renewal-review/server.py"],
        "fixture_sha256": source_hashes["labs/source-fixtures.json"],
        "source_hashes": source_hashes,
        "initialization": owner["initialization"],
        "checks_are_require_gated_summary": True,
        "checks": {
            "initialize": True,
            "list_tools": True,
            "successful_read": True,
            "denied_actor_before_fixture_read_in_process": True,
            "denied_actor_received_stdio_error_result": True,
            "extra_input_rejected": True,
            "unexpected_account_rejected": True,
            "unknown_tool_rejected": True,
            "write_tool_rejected": True,
            "owner_stdio_context_exit_clean": owner["context_exit_clean"],
            "denied_stdio_context_exit_clean": denied["context_exit_clean"],
            "initialize_probe_stdout_json_rpc_only": True,
            "discount_unknown_preserved": True,
            "sso_unknown_preserved": True,
        },
        "observations": {
            "stdout_probe": stdout_probe,
            "stdio_shutdown": {
                "inference": "clean ClientSession and stdio_client context exit without exception",
                "sdk_managed_child_return_code_observed": False,
            },
            "owner_server_stderr_present": owner["server_stderr_present"],
            "denied_server_stderr_present": denied["server_stderr_present"],
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
