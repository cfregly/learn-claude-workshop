#!/usr/bin/env python3
"""Focused offline tests for the renewal review MCP server."""

from __future__ import annotations

import asyncio
import importlib.util
import sys
import unittest
from pathlib import Path


SERVER_PATH = Path(__file__).with_name("server.py")
SPEC = importlib.util.spec_from_file_location("renewal_review_server", SERVER_PATH)
assert SPEC and SPEC.loader
server_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = server_module
SPEC.loader.exec_module(server_module)


class RenewalReviewServerTests(unittest.IsolatedAsyncioTestCase):
    async def test_lists_one_strict_read_only_tool(self) -> None:
        server, _store = server_module.build_server("demo-account-owner")
        tools = await server.list_tools()

        self.assertEqual([tool.name for tool in tools], [server_module.TOOL_NAME])
        tool = tools[0]
        self.assertEqual(set(tool.input_schema["properties"]), {"account_id"})
        self.assertIs(tool.input_schema["additionalProperties"], False)
        self.assertIs(tool.annotations.read_only_hint, True)
        self.assertIs(tool.annotations.destructive_hint, False)

    async def test_authorized_result_uses_only_public_contract(self) -> None:
        server, store = server_module.build_server("demo-account-owner")
        result = await server.call_tool(server_module.TOOL_NAME, {"account_id": server_module.ACCOUNT_ID})

        self.assertFalse(result.is_error)
        self.assertEqual(store.fixture_reads, 1)
        self.assertEqual(
            set(result.structured_content),
            {"synthetic", "account_id", "source_id", "source_ids", "notes", "access_checked", "actor_id"},
        )
        self.assertNotIn("expected", result.structured_content)
        self.assertIn("Approval is not recorded", result.structured_content["notes"])
        self.assertIn("no entitlement information", result.structured_content["notes"])

    async def test_denied_actor_stops_before_fixture_read(self) -> None:
        reads = 0

        def forbidden_reader(_path: Path) -> str:
            nonlocal reads
            reads += 1
            raise AssertionError("denied actor reached the fixture")

        server, store = server_module.build_server("demo-no-access", reader=forbidden_reader)
        with self.assertRaises(server_module.ToolError):
            await server.call_tool(server_module.TOOL_NAME, {"account_id": server_module.ACCOUNT_ID})

        self.assertEqual(reads, 0)
        self.assertEqual(store.fixture_reads, 0)

    async def test_rejects_extra_missing_and_unexpected_input(self) -> None:
        server, store = server_module.build_server("demo-account-owner")
        invalid = [
            {"account_id": server_module.ACCOUNT_ID, "actor_id": "demo-account-owner"},
            {},
            {"account_id": "another-account"},
        ]
        for arguments in invalid:
            with self.subTest(arguments=arguments):
                with self.assertRaises(server_module.ToolError):
                    await server.call_tool(server_module.TOOL_NAME, arguments)
        self.assertEqual(store.fixture_reads, 0)

    async def test_rejects_unknown_and_write_tools(self) -> None:
        server, _store = server_module.build_server("demo-account-owner")
        for name in ["unknown_tool", "update_northstar_account", "write_northstar_account"]:
            with self.subTest(name=name):
                with self.assertRaises(server_module.ToolError):
                    await server.call_tool(name, {"account_id": server_module.ACCOUNT_ID})

    def test_server_source_has_no_application_stdout_writes(self) -> None:
        source = SERVER_PATH.read_text(encoding="utf-8")
        self.assertNotIn("print(", source)
        self.assertNotIn("sys.stdout", source)


if __name__ == "__main__":
    unittest.main()
