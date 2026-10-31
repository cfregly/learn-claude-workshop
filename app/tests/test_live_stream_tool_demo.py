#!/usr/bin/env python3
"""Offline tests for the live streaming Python lab."""

from __future__ import annotations

import importlib.util
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "public"
    / "materials"
    / "live-stream-tool-demo.py"
)
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("live_stream_tool_demo", MODULE_PATH)
assert SPEC and SPEC.loader
demo = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = demo
SPEC.loader.exec_module(demo)


def text_block(text: str) -> dict[str, str]:
    return {"type": "text", "text": text}


def tool_block(account_id: str = demo.ACCOUNT_ID) -> dict[str, object]:
    return {
        "type": "tool_use",
        "id": "toolu_test_001",
        "name": demo.TOOL_NAME,
        "input": {"account_id": account_id},
    }


def text_event(text: str) -> dict[str, object]:
    return {
        "type": "content_block_delta",
        "delta": {"type": "text_delta", "text": text},
    }


class FakeStream:
    def __init__(self, events: list[dict[str, object]], message: object) -> None:
        self.events = events
        self.message = message
        self.final_message_reads = 0

    def __enter__(self) -> "FakeStream":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def __iter__(self):
        return iter(self.events)

    def get_final_message(self) -> object:
        self.final_message_reads += 1
        return self.message


class FakeMessages:
    def __init__(self, streams: list[FakeStream]) -> None:
        self.streams = streams
        self.calls: list[dict[str, object]] = []

    def stream(self, **request: object) -> FakeStream:
        self.calls.append(request)
        return self.streams[len(self.calls) - 1]


class FakeClient:
    def __init__(self, streams: list[FakeStream]) -> None:
        self.messages = FakeMessages(streams)


def complete_stream(message: object, text: str) -> FakeStream:
    return FakeStream(
        [text_event(text), {"type": "message_stop"}],
        message,
    )


class LiveStreamToolDemoTests(unittest.TestCase):
    def test_offline_default_does_not_import_sdk_or_call_tool(self) -> None:
        stdout = io.StringIO()
        with mock.patch.object(demo, "lookup_northstar_account") as lookup:
            exit_code = demo.main([])
            demo.print_offline_plan(stdout)
        self.assertEqual(exit_code, 0)
        lookup.assert_not_called()
        self.assertIn("network_calls=0", stdout.getvalue())
        self.assertIn("tool_calls=0", stdout.getvalue())

    def test_sdk_client_uses_bearer_auth_version_timeout_and_no_retries(self) -> None:
        client_class = mock.Mock(return_value=object())

        client = demo.build_sdk_client("synthetic-secret", client_class)

        self.assertIs(client, client_class.return_value)
        client_class.assert_called_once_with(
            auth_token="synthetic-secret",
            base_url="https://api.anthropic.com",
            default_headers={"anthropic-version": "2026-10-21"},
            max_retries=0,
            timeout=60.0,
        )
        self.assertNotIn("api_key", client_class.call_args.kwargs)

    def test_environment_base_url_cannot_redirect_bearer_client(self) -> None:
        def fake_client(**options: object) -> SimpleNamespace:
            return SimpleNamespace(
                base_url=options.get("base_url")
                or demo.os.environ.get("ANTHROPIC_BASE_URL"),
                auth_token=options.get("auth_token"),
            )

        client_class = mock.Mock(side_effect=fake_client)
        with mock.patch.dict(
            demo.os.environ, {"ANTHROPIC_BASE_URL": "https://alternate.example.invalid"}
        ):
            client = demo.build_sdk_client("synthetic-secret", client_class)

        self.assertEqual(client.base_url, "https://api.anthropic.com")
        self.assertEqual(client.auth_token, "synthetic-secret")
        self.assertEqual(
            client_class.call_args.kwargs.get("base_url"), "https://api.anthropic.com"
        )
        self.assertNotIn("api_key", client_class.call_args.kwargs)

    def test_live_cycle_preserves_blocks_and_matches_tool_result_id(self) -> None:
        first_message = SimpleNamespace(
            stop_reason="tool_use",
            content=[
                {
                    "type": "thinking",
                    "thinking": "Synthetic signed thinking block for round-trip testing.",
                    "signature": "opaque_test_signature",
                },
                text_block("I will read the fixture. "),
                tool_block(),
            ],
        )
        second_message = SimpleNamespace(
            stop_reason="end_turn",
            content=[text_block("Northstar draft for review.")],
        )
        client = FakeClient(
            [
                complete_stream(first_message, "I will read the fixture. "),
                complete_stream(second_message, "Northstar draft for review."),
            ]
        )
        output = io.StringIO()
        lookup_result = {
            "synthetic": True,
            "read_only": True,
            "account_id": demo.ACCOUNT_ID,
        }
        lookup = mock.Mock(return_value=lookup_result)

        demo.run_live(client, demo.SONNET_BETWEEN_TOOLS_MODEL, output, lookup)

        self.assertEqual(len(client.messages.calls), 2)
        lookup.assert_called_once_with(demo.ACCOUNT_ID)
        second_request = client.messages.calls[1]
        assistant_turn = second_request["messages"][-2]
        result_turn = second_request["messages"][-1]
        self.assertEqual(assistant_turn["content"], first_message.content)
        self.assertEqual(result_turn["content"][0]["tool_use_id"], "toolu_test_001")
        self.assertEqual(second_request["tools"], [demo.TOOL_DEFINITION])
        self.assertEqual(
            client.messages.calls[0]["thinking"],
            {"type": "between_tools"},
        )
        self.assertEqual(second_request["thinking"], {"type": "between_tools"})
        self.assertNotIn("tool_choice", client.messages.calls[0])
        self.assertNotIn("tool_choice", second_request)
        self.assertIn("provider_calls=2", output.getvalue())
        self.assertIn("read_only_lookups=1", output.getvalue())

    def test_other_models_do_not_get_a_hardcoded_thinking_mode(self) -> None:
        first = demo.build_first_request("another-enabled-model")
        second = demo.build_second_request("another-enabled-model", first["messages"])

        self.assertNotIn("thinking", first)
        self.assertNotIn("thinking", second)
        self.assertNotIn("tool_choice", first)
        self.assertNotIn("tool_choice", second)

    def test_wrong_account_stops_before_lookup_and_second_call(self) -> None:
        first_message = SimpleNamespace(
            stop_reason="tool_use",
            content=[tool_block("another-account")],
        )
        client = FakeClient([complete_stream(first_message, "")])
        lookup = mock.Mock()

        with self.assertRaises(demo.LabError) as caught:
            demo.run_live(client, "test-model", io.StringIO(), lookup)

        self.assertEqual(caught.exception.exit_code, demo.EXIT_PROTOCOL)
        self.assertEqual(len(client.messages.calls), 1)
        lookup.assert_not_called()

    def test_local_lookup_checks_policy_before_reading_fixture(self) -> None:
        with mock.patch.object(Path, "read_text") as read_text:
            with self.assertRaises(demo.LabError):
                demo.lookup_northstar_account("another-account")
        read_text.assert_not_called()

    def test_bundled_lookup_returns_only_the_synthetic_baseline(self) -> None:
        result = demo.lookup_northstar_account(demo.ACCOUNT_ID)

        self.assertEqual(result["account_id"], demo.ACCOUNT_ID)
        self.assertEqual(result["source_id"], "source-fixtures.json#baseline")
        self.assertEqual(result["caller_fixture"], "demo-account-owner")
        self.assertIs(result["synthetic"], True)
        self.assertIs(result["read_only"], True)
        self.assertIn("Approval is not recorded", result["notes"])
        self.assertIn("no entitlement information", result["notes"])

    def test_multiple_tool_requests_stop_before_any_lookup(self) -> None:
        first_message = SimpleNamespace(
            stop_reason="tool_use",
            content=[tool_block(), {**tool_block(), "id": "toolu_test_002"}],
        )
        client = FakeClient([complete_stream(first_message, "")])
        lookup = mock.Mock()

        with self.assertRaises(demo.LabError):
            demo.run_live(client, "test-model", io.StringIO(), lookup)

        self.assertEqual(len(client.messages.calls), 1)
        lookup.assert_not_called()

    def test_partial_first_stream_keeps_text_and_runs_no_tool(self) -> None:
        first_message = SimpleNamespace(stop_reason="tool_use", content=[tool_block()])
        client = FakeClient([FakeStream([text_event("Partial provider text")], first_message)])
        output = io.StringIO()
        lookup = mock.Mock()

        with self.assertRaises(demo.LabError) as caught:
            demo.run_live(client, "test-model", output, lookup)

        self.assertEqual(caught.exception.exit_code, demo.EXIT_INCOMPLETE)
        self.assertIn("Partial provider text", output.getvalue())
        self.assertIn("status=incomplete", output.getvalue())
        self.assertEqual(len(client.messages.calls), 1)
        lookup.assert_not_called()

    def test_partial_final_stream_stays_incomplete_after_one_lookup(self) -> None:
        first_message = SimpleNamespace(stop_reason="tool_use", content=[tool_block()])
        second_message = SimpleNamespace(
            stop_reason="end_turn",
            content=[text_block("Partial final draft")],
        )
        client = FakeClient(
            [
                complete_stream(first_message, ""),
                FakeStream([text_event("Partial final draft")], second_message),
            ]
        )
        output = io.StringIO()
        lookup = mock.Mock(return_value={"synthetic": True, "read_only": True})

        with self.assertRaises(demo.LabError) as caught:
            demo.run_live(client, "test-model", output, lookup)

        self.assertEqual(caught.exception.exit_code, demo.EXIT_INCOMPLETE)
        self.assertIn("Partial final draft", output.getvalue())
        self.assertIn("status=incomplete", output.getvalue())
        self.assertEqual(len(client.messages.calls), 2)
        lookup.assert_called_once_with(demo.ACCOUNT_ID)


if __name__ == "__main__":
    unittest.main()
