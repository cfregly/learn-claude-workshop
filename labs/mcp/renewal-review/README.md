# Renewal review MCP lab

This standalone lab exposes one real STDIO MCP tool named `lookup_northstar_account`. It reads only the bundled synthetic `northstar-freight` baseline. It has no model call, network call, CRM connection, write tool, credential, or customer action.

The server host must choose one trusted synthetic actor at startup. The actor is not part of the tool schema.

## Set up in a temporary environment

From the repository root:

```bash
python3 -m venv /tmp/renewal-review-mcp-venv
/tmp/renewal-review-mcp-venv/bin/python -m pip install -r requirements-mcp.txt
```

## Run the server

```bash
/tmp/renewal-review-mcp-venv/bin/python labs/mcp/renewal-review/server.py --actor demo-account-owner
```

The process reserves stdout for newline-delimited JSON-RPC. Diagnostics belong on stderr.

## Run the bounded smoke

```bash
/tmp/renewal-review-mcp-venv/bin/python labs/mcp/renewal-review/smoke.py \
  --python /tmp/renewal-review-mcp-venv/bin/python \
  --export /tmp/northstar-mcp-result.json \
  --receipt /tmp/renewal-review-smoke-receipt.json
```

The smoke initializes real STDIO sessions, lists the one tool, performs the allowed lookup, rejects an extra actor field, rejects an unexpected account, and rejects unknown and write tool names. It checks in process that the denied actor never reaches the fixture reader. In a separate STDIO session it checks that the denied actor receives an error result.

A scripted initialize probe captures the server process stdout directly. Every non-empty captured line must parse as a JSON-RPC 2.0 message. The probe covers one initialize request followed by input EOF. It records the server process return code for that probe. The SDK-managed owner and denied sessions expose clean context exit, not the child process return code. Their shutdown status is therefore an inference from `ClientSession` and `stdio_client` exiting without an exception.

The exported allowed result is synthetic JSON for the separate Skill runner. It contains no credentials or answer-key field.

## Observed local validation

The published [sanitized smoke receipt](observed-smoke-receipt.json) records one observed local run. It includes the timestamp, SDK and protocol versions, Python and platform values, final source hashes, the allowed synthetic result, and bounded observations. Its `checks` object is a require-gated summary. A true value means the corresponding assertion completed without failure. It is not a separate measurement stream.

The actual stdout claim is limited to the captured initialize probe. The static server test separately checks that application code contains no `print` or `sys.stdout` call. The receipt labels the owner and denied session shutdown result as a clean-context-exit inference.

Seven focused tests cover the original six server behaviors and rejection of non-JSON-RPC stdout by the new probe validator.

The startup actor is a fixture role selected by the process launcher. It is not an authenticated employee identity. `access_checked` records the local allowlist decision, and `source_ids` are labels within fictional notes. They do not establish reads from external CRM, call, support, or usage systems.

This implementation was checked against `mcp==2.3.0`. `ToolAnnotations` uses the SDK model's snake case field names and the SDK serializes their protocol aliases. The `list_tools` and `call_tool` overrides follow the method signatures inspected in that SDK release.

## Interface

Input:

```json
{"account_id":"northstar-freight"}
```

Output fields:

- `synthetic`
- `account_id`
- `source_id`
- `source_ids`
- `notes`
- `access_checked`
- `actor_id`

The source notes preserve discount approval and SSO entitlement as unknown. The trusted startup actor must be `demo-account-owner` for a successful read. `demo-no-access` is provided for the denial check.

The transport and registration follow the [MCP server guide](https://modelcontextprotocol.io/docs/develop/build-server) and [Python SDK](https://github.com/modelcontextprotocol/python-sdk). The Northstar fixture, lookup, actor policy, and tests are specific to this workshop.
