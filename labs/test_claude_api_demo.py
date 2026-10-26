#!/usr/bin/env python3
"""Offline tests for the prepared direct Claude API client."""

from __future__ import annotations

import copy
import importlib.util
import io
import json
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError


CLIENT_PATH = Path(__file__).resolve().parent / "claude_api_demo.py"
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("claude_api_demo", CLIENT_PATH)
assert SPEC and SPEC.loader
demo = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = demo
SPEC.loader.exec_module(demo)


class FakeResponse:
    def __init__(self, body: dict, request_id: str = "req_offline_test") -> None:
        self.raw = json.dumps(body).encode("utf-8")
        self.headers = {"request-id": request_id}
        self.status = 200

    def read(self, _maximum: int) -> bytes:
        return self.raw

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None


class ApiClientTests(unittest.TestCase):
    def run_body(self, body: dict) -> tuple[int, str, str]:
        stdout = io.StringIO()
        stderr = io.StringIO()
        with mock.patch.object(demo, "urlopen", return_value=FakeResponse(body)):
            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = demo.make_live_call({"model": "test-model", "messages": []}, "placeholder-key")
        return exit_code, stdout.getvalue(), stderr.getvalue()

    def test_text_only_payload_defines_no_tools_or_stop_sequences(self) -> None:
        payload, record_count = demo.build_payload("demo-account-owner", "northstar-freight", "test-model")
        self.assertEqual(record_count, 4)
        self.assertNotIn("tools", payload)
        self.assertNotIn("stop_sequences", payload)
        self.assertEqual(payload["messages"][0]["content"][0]["type"], "text")

    def test_classification_is_pure(self) -> None:
        body = {
            "content": [{"type": "text", "text": "Review me"}],
            "stop_reason": "end_turn",
        }
        original = copy.deepcopy(body)
        first = demo.classify_response(body)
        second = demo.classify_response(body)
        self.assertEqual(body, original)
        self.assertEqual(first, second)
        self.assertEqual(first.draft_status, "ready_for_human_review")
        self.assertEqual(first.business_status, "not_accepted")

    def test_documented_stop_reasons_keep_status_boundaries(self) -> None:
        cases = [
            (
                "end turn with text",
                {"content": [{"type": "text", "text": "Draft text"}], "stop_reason": "end_turn"},
                0,
                "generation_status=completed_end_turn",
                "generation_terminal=yes",
                "draft_status=ready_for_human_review",
            ),
            (
                "max tokens",
                {"content": [{"type": "text", "text": "Partial text"}], "stop_reason": "max_tokens"},
                demo.EXIT_INCOMPLETE_GENERATION,
                "generation_status=incomplete_max_tokens",
                "generation_terminal=no",
                "draft_status=not_ready",
            ),
            (
                "refusal",
                {"content": [{"type": "text", "text": "Unable to help"}], "stop_reason": "refusal"},
                demo.EXIT_REFUSAL,
                "generation_status=refused",
                "generation_terminal=yes",
                "draft_status=not_ready",
            ),
            (
                "empty end turn",
                {"content": [], "stop_reason": "end_turn"},
                demo.EXIT_EMPTY_DRAFT,
                "generation_status=completed_end_turn_empty",
                "generation_terminal=yes",
                "draft_status=not_ready",
            ),
            (
                "unexpected client tool",
                {
                    "content": [
                        {"type": "text", "text": "I would call a tool"},
                        {"type": "tool_use", "id": "toolu_test", "name": "not_configured", "input": {}},
                    ],
                    "stop_reason": "tool_use",
                },
                demo.EXIT_UNEXPECTED_CONTINUATION,
                "generation_status=unexpected_continuation",
                "generation_terminal=no",
                "draft_status=not_ready",
            ),
            (
                "unexpected pause turn",
                {"content": [{"type": "text", "text": "Paused text"}], "stop_reason": "pause_turn"},
                demo.EXIT_UNEXPECTED_CONTINUATION,
                "generation_status=unexpected_continuation",
                "generation_terminal=no",
                "draft_status=not_ready",
            ),
            (
                "context window",
                {"content": [{"type": "text", "text": "Context partial"}], "stop_reason": "model_context_window_exceeded"},
                demo.EXIT_INCOMPLETE_GENERATION,
                "generation_status=incomplete_model_context_window_exceeded",
                "generation_terminal=no",
                "draft_status=not_ready",
            ),
            (
                "unexpected stop sequence",
                {"content": [{"type": "text", "text": "Stopped text"}], "stop_reason": "stop_sequence"},
                demo.EXIT_UNEXPECTED_STOP,
                "generation_status=unexpected_stop_sequence",
                "generation_terminal=no",
                "draft_status=not_ready",
            ),
        ]

        for label, body, expected_exit, generation, terminal, draft in cases:
            with self.subTest(label=label):
                exit_code, stdout, stderr = self.run_body(body)
                self.assertEqual(exit_code, expected_exit)
                self.assertEqual(stderr, "")
                self.assertIn("http_status=200", stdout)
                self.assertIn("http_transport_status=completed", stdout)
                self.assertIn(generation, stdout)
                self.assertIn(terminal, stdout)
                self.assertIn(draft, stdout)
                self.assertIn("business_status=not_accepted", stdout)
                self.assertIn("request_id=req_offline_test", stdout)
                for block in body["content"]:
                    if block.get("type") == "text":
                        self.assertIn(block["text"], stdout)

    def test_malformed_response_is_not_a_ready_draft(self) -> None:
        exit_code, stdout, _stderr = self.run_body({"content": "not-a-block-list", "stop_reason": "end_turn"})
        self.assertEqual(exit_code, demo.EXIT_RESPONSE_ERROR)
        self.assertIn("generation_status=malformed_response", stdout)
        self.assertIn("generation_terminal=unknown", stdout)
        self.assertIn("draft_status=not_ready", stdout)
        self.assertIn("business_status=not_accepted", stdout)

    def test_http_error_stays_an_http_error_without_retry(self) -> None:
        error_body = io.BytesIO(json.dumps({
            "error": {"type": "invalid_request_error", "message": "synthetic bad request"}
        }).encode("utf-8"))
        error = HTTPError(
            demo.API_URL,
            400,
            "Bad Request",
            {"request-id": "req_http_error"},
            error_body,
        )
        stdout = io.StringIO()
        stderr = io.StringIO()
        with mock.patch.object(demo, "urlopen", side_effect=error) as urlopen_mock:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = demo.make_live_call({"model": "test-model", "messages": []}, "placeholder-key")
        error.close()
        self.assertEqual(exit_code, demo.EXIT_RESPONSE_ERROR)
        self.assertEqual(urlopen_mock.call_count, 1)
        self.assertEqual(stdout.getvalue(), "")
        self.assertIn("http_status=400", stderr.getvalue())
        self.assertIn("http_transport_status=http_error", stderr.getvalue())
        self.assertIn("request_id=req_http_error", stderr.getvalue())

    def test_dry_run_describes_only_this_local_client(self) -> None:
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            demo.print_dry_run_instructions()
        output = stdout.getvalue()
        self.assertIn("This local client does not send your environment values to the workshop site.", output)
        self.assertNotIn("never collects or stores", output)


if __name__ == "__main__":
    unittest.main()
