# Northstar live Claude API lab

This is the actual HTTP server and live-demo handler used by the workshop, with its role titles and task configuration. The website interface is not included in this lab. All examples use fictional Northstar records.

The server calls the direct Claude Messages API. It reads the model credential from the process environment and never returns it to the caller. It accepts a fixed role and source variation, not an arbitrary prompt. Generation returns a draft for review. A `max_tokens` result preserves partial text and stays incomplete. Even `end_turn` requires checks for required fields and supporting sources.

## Run

Use Node.js 22 or later. No package installation is needed. Set `ANTHROPIC_API_KEY` to your own approved key and `ANTHROPIC_MODEL` to a model enabled in that account. Do not commit credentials.

```sh
export MODEL_BUDGET_FILE="$PWD/.local/model-usage.json"
export PORT=18120
node server.mjs
```

Without both credential and model settings, the health and capability endpoints remain available and generation is unavailable.

Inspect capability:

```sh
curl http://127.0.0.1:18120/api/demo
```

Make one live request after reviewing the fixed synthetic context in `live-demo.mjs`:

```sh
curl http://127.0.0.1:18120/api/demo \
  -H 'Origin: http://127.0.0.1:18120' \
  -H 'Content-Type: application/json' \
  --data '{"role_id":"account-executive","case_id":"baseline"}'
```

Other source cases are `conflicting-date`, `unsupported-sso`, and `injected-source`. Each changes one assumption while keeping the same account.

## Trace and review

The response includes the sanitized request, typed output text, stop reason, model, input and output tokens, application trace identifier, provider request identifier, and elapsed time. Authentication is absent from the trace.

Find the boundary between account access and model invocation. The lab contains approved synthetic records only, so it does not implement employee login or a customer record system. A production application must authorize the employee and account before retrieving records and before any model call. A valid API credential does not grant that access.

Limits are two concurrent calls, a 25 second deadline, 900 output tokens, a short client cooldown, and 100 attempted calls per UTC day. The allowance persists in `MODEL_BUDGET_FILE`. Transient failures are not retried automatically. The same-origin browser check is not employee authentication.

Run the focused tests with `npm test`. They inject a provider response and make no paid model calls. Compare the request and response tests with [Anthropic's stop-reason guidance](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) and [streaming guide](https://platform.claude.com/docs/en/build-with-claude/streaming).

## Contextual learner questions

`POST /api/ask` accepts a question of at most 1,200 characters, fixed context identifiers, and at most four short user or assistant history turns. It rebuilds trusted teaching context from the course files. It does not receive a learner draft. Questions and fixed examples share the same persisted allowance. `MAX_DAILY_CALLS` may select an integer from 1 through 300.

```sh
curl http://127.0.0.1:18120/api/ask \
  -H 'Origin: http://127.0.0.1:18120' \
  -H 'Content-Type: application/json' \
  --data '{"question":"Why is max_tokens incomplete?","context":{"role_id":"software-engineer-api","step":2}}'
```

The simulated streaming module supplies canonical event and application state when a question includes its validated scenario, step, and role identifiers. See the [streaming reference](../../docs/streaming-lab.md), [thinking lesson](../../docs/thinking-lab.md), and [dated model-capability excerpt](../../docs/model-capabilities.json). These are teaching artifacts. Simulated tool receipts do not report real account actions.
