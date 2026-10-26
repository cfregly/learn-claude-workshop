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
  --export /tmp/northstar-mcp-result.json
```

The smoke initializes a real STDIO session, lists the one tool, performs the allowed lookup, rejects an extra actor field, rejects an unexpected account, rejects unknown and write tool names, checks the denied actor before a fixture read, and closes both server processes through the SDK transport.

The exported allowed result is synthetic JSON for the separate Skill runner. It contains no credentials or answer-key field.

## Observed local validation

The October 26, 2026 smoke used `mcp==2.3.0` and negotiated protocol `2025-11-25`. It passed initialization, discovery, the allowed lookup, rejected inputs and tool names, denied access before a fixture read, and orderly shutdown with JSON-RPC-only stdout. Six focused server tests also passed. These observations establish local protocol behavior for this version.

The startup actor is a fixture role selected by the process launcher. It is not an authenticated employee identity. `access_checked` records the local allowlist decision, and `source_ids` are labels within fictional notes. They do not establish reads from external CRM, call, support, or usage systems.

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
