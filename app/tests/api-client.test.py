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
from email.message import Message
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError, URLError
from urllib import request as urllib_request
from urllib.response import addinfourl


CLIENT_PATH = Path(__file__).resolve().parents[1] / "public" / "materials" / "claude_api_demo.py"
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
    DUMMY_KEY = "DUMMY_CREDENTIAL_MARKER"

    def run_redirect(self, status: int, target: str):
        contacted = []
        authorizations = []

        class MemoryHTTPSHandler(urllib_request.HTTPSHandler):
            def https_open(self, request):
                contacted.append(request.full_url)
                authorizations.append(request.get_header("Authorization"))
                headers = Message()
                headers["request-id"] = "req_redirect_test"
                if request.full_url == demo.API_URL:
                    headers["Location"] = target
                    body = {}
                    response_status = status
                else:
                    body = {
                        "content": [{"type": "text", "text": "Redirect target draft"}],
                        "stop_reason": "end_turn",
                    }
                    response_status = 200
                response = addinfourl(
                    io.BytesIO(json.dumps(body).encode()), headers,
                    request.full_url, response_status,
                )
                response.msg = "Synthetic response"
                return response

        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            mock.patch.object(urllib_request, "HTTPSHandler", MemoryHTTPSHandler),
            mock.patch.object(urllib_request, "_opener", None),
            mock.patch("socket.create_connection", side_effect=AssertionError("External network forbidden")) as network,
            redirect_stdout(stdout), redirect_stderr(stderr),
        ):
            code = demo.make_live_call({"model": "offline-test", "messages": []}, self.DUMMY_KEY)
        network.assert_not_called()
        return code, stdout.getvalue(), stderr.getvalue(), contacted, authorizations

    def run_transport(self, key: str, *, response=None, error=None):
        if response is None:
            response = FakeResponse({
                "content": [{"type": "text", "text": "Synthetic draft"}],
                "stop_reason": "end_turn",
            })
        stdout, stderr = io.StringIO(), io.StringIO()
        with mock.patch.object(demo, "open_without_redirects", return_value=response, side_effect=error) as opener:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                code = demo.make_live_call({"model": "offline-test", "messages": []}, key)
        return code, stdout.getvalue(), stderr.getvalue(), opener

    def run_body(self, body: dict) -> tuple[int, str, str]:
        stdout = io.StringIO()
        stderr = io.StringIO()
        with mock.patch.object(demo, "open_without_redirects", return_value=FakeResponse(body)):
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
        with mock.patch.object(demo, "open_without_redirects", side_effect=error) as urlopen_mock:
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

    def test_internal_whitespace_and_controls_are_rejected_before_transport(self) -> None:
        for character in ("\n", "\r", "\t", " ", "\x00", "\x1f", "\x7f", "\x85"):
            with self.subTest(character=repr(character)):
                code, stdout, stderr, opener = self.run_transport(
                    self.DUMMY_KEY + character + "TAIL"
                )
                self.assertEqual(code, demo.EXIT_LIVE_ENV_REQUIRED)
                opener.assert_not_called()
                self.assertIn("credential_error=invalid_api_key", stderr)
                self.assertIn("http_transport_status=not_started", stderr)
                self.assertNotIn(self.DUMMY_KEY, stdout + stderr)

    def test_surrounding_whitespace_is_stripped_before_authorization_header(self) -> None:
        code, _stdout, stderr, opener = self.run_transport(" \t" + self.DUMMY_KEY + "\r\n")
        self.assertEqual(code, 0)
        self.assertEqual(stderr, "")
        request = opener.call_args.args[0]
        self.assertEqual(request.get_header("Authorization"), "Bearer " + self.DUMMY_KEY)
        self.assertEqual(request.full_url, demo.API_URL)
        self.assertEqual(opener.call_count, 1)

    def test_cli_rejects_invalid_key_before_live_call(self) -> None:
        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            mock.patch.dict(demo.os.environ, {
                "ANTHROPIC_API_KEY": self.DUMMY_KEY + "\nTAIL",
                "ANTHROPIC_MODEL": "offline-test",
            }),
            mock.patch.object(demo, "make_live_call") as call,
            redirect_stdout(stdout), redirect_stderr(stderr),
        ):
            code = demo.main(["--live"])
        self.assertEqual(code, demo.EXIT_LIVE_ENV_REQUIRED)
        call.assert_not_called()
        self.assertNotIn(self.DUMMY_KEY, stdout.getvalue() + stderr.getvalue())

    def test_cli_passes_only_stripped_key_to_live_call(self) -> None:
        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            mock.patch.dict(demo.os.environ, {
                "ANTHROPIC_API_KEY": " \t" + self.DUMMY_KEY + "\r\n",
                "ANTHROPIC_MODEL": "offline-test",
            }),
            mock.patch.object(demo, "make_live_call", return_value=0) as call,
            redirect_stdout(stdout), redirect_stderr(stderr),
        ):
            code = demo.main(["--live"])
        self.assertEqual(code, 0)
        self.assertEqual(call.call_args.args[1], self.DUMMY_KEY)
        self.assertNotIn(self.DUMMY_KEY, stdout.getvalue() + stderr.getvalue())

    def test_request_preparation_exception_is_sanitized_transport_error(self) -> None:
        with mock.patch.object(demo, "Request", side_effect=ValueError("Bearer " + self.DUMMY_KEY)):
            code, stdout, stderr, opener = self.run_transport(self.DUMMY_KEY)
        self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
        opener.assert_not_called()
        self.assertIn("transport_error=ValueError", stderr)
        self.assertIn("http_transport_status=transport_error", stderr)
        self.assertNotIn(self.DUMMY_KEY, stdout + stderr)

    def test_transport_exceptions_never_echo_credential_or_claim_completed(self) -> None:
        errors = [
            ValueError("Invalid header value: Bearer " + self.DUMMY_KEY),
            URLError("Bearer " + self.DUMMY_KEY),
            TimeoutError(self.DUMMY_KEY),
            OSError(self.DUMMY_KEY),
            RuntimeError(self.DUMMY_KEY),
        ]
        for error in errors:
            with self.subTest(error_class=type(error).__name__):
                code, stdout, stderr, opener = self.run_transport(self.DUMMY_KEY, error=error)
                self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
                self.assertEqual(opener.call_count, 1)
                self.assertIn("transport_error=" + type(error).__name__, stderr)
                self.assertIn("http_transport_status=transport_error", stderr)
                self.assertNotIn("http_transport_status=completed", stderr)
                self.assertNotIn(self.DUMMY_KEY, stdout + stderr)

    def test_http_error_reason_body_and_request_id_cannot_echo_credential(self) -> None:
        error = HTTPError(
            demo.API_URL, 401, "Bearer " + self.DUMMY_KEY,
            {"request-id": "req_" + self.DUMMY_KEY},
            io.BytesIO(json.dumps({
                "request_id": "req_" + self.DUMMY_KEY,
                "error": {"type": self.DUMMY_KEY, "message": "Bearer " + self.DUMMY_KEY},
            }).encode()),
        )
        try:
            code, stdout, stderr, opener = self.run_transport(self.DUMMY_KEY, error=error)
        finally:
            error.close()
        self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
        self.assertEqual(opener.call_count, 1)
        self.assertIn("http_status=401", stderr)
        self.assertIn("error_class=HTTPError", stderr)
        self.assertIn("request_id=unavailable", stderr)
        self.assertIn("http_transport_status=http_error", stderr)
        self.assertNotIn(self.DUMMY_KEY, stdout + stderr)

    def test_invalid_json_is_a_completed_transport_without_ready_draft(self) -> None:
        response = FakeResponse({})
        response.raw = b"not-json " + self.DUMMY_KEY.encode()
        code, stdout, stderr, opener = self.run_transport(self.DUMMY_KEY, response=response)
        self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
        self.assertEqual(opener.call_count, 1)
        self.assertIn("http_status=200", stderr)
        self.assertIn("http_transport_status=completed", stderr)
        self.assertIn("response_error=invalid_json_response", stderr)
        self.assertIn("error_class=JSONDecodeError", stderr)
        self.assertIn("request_id=req_offline_test", stderr)
        self.assertNotIn("ready_for_human_review", stdout + stderr)
        self.assertNotIn(self.DUMMY_KEY, stdout + stderr)

    def test_response_parse_exception_text_is_never_printed(self) -> None:
        with mock.patch.object(demo, "parse_json_bytes", side_effect=ValueError(self.DUMMY_KEY)):
            code, stdout, stderr, _opener = self.run_transport(self.DUMMY_KEY)
        self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
        self.assertIn("http_transport_status=completed", stderr)
        self.assertIn("error_class=ValueError", stderr)
        self.assertNotIn(self.DUMMY_KEY, stdout + stderr)

    def test_cross_origin_redirects_are_refused_before_target_contact(self) -> None:
        target = "https://redirect-target.example.invalid/collect"
        for status in (301, 302, 303, 307, 308):
            with self.subTest(status=status):
                code, stdout, stderr, contacted, authorizations = self.run_redirect(status, target)
                self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
                self.assertEqual(contacted, [demo.API_URL])
                self.assertEqual(authorizations, ["Bearer " + self.DUMMY_KEY])
                self.assertEqual(stdout, "")
                self.assertIn(f"http_status={status}", stderr)
                self.assertIn("http_transport_status=http_error", stderr)
                self.assertIn("error_class=HTTPError", stderr)
                self.assertIn("request_id=req_redirect_test", stderr)
                self.assertNotIn(self.DUMMY_KEY, stdout + stderr)
                self.assertNotIn(target, stdout + stderr)

    def test_same_origin_redirect_is_also_refused_without_second_request(self) -> None:
        target = "https://api.anthropic.com/redirect-target"
        code, stdout, stderr, contacted, _authorizations = self.run_redirect(302, target)
        self.assertEqual(code, demo.EXIT_RESPONSE_ERROR)
        self.assertEqual(contacted, [demo.API_URL])
        self.assertIn("http_status=302", stderr)
        self.assertIn("http_transport_status=http_error", stderr)
        self.assertNotIn(self.DUMMY_KEY, stdout + stderr)


if __name__ == "__main__":
    unittest.main()
