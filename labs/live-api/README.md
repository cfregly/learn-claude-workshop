# Northstar live Claude API lab

This folder is the focused backend lab extracted from the runnable app in `../../app/`. It contains the same server handler, Claude SDK dependency, fixed synthetic role context, usage controls, and backend tests. All Northstar records are fictional.

The full browser interface is available in `../../app/`. This lab keeps only the public modules and fixture files required by the backend so learners can inspect the request boundary without the rest of the interface.

## Run

Use Node.js 22 or later.

```bash
npm ci
export MODEL_BUDGET_FILE="$PWD/.local/model-usage.json"
npm start
```

Without approved `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` environment settings, the health and capability endpoints remain available while generation stays unavailable. Do not commit credentials.

Inspect capability:

```bash
curl http://127.0.0.1:18120/api/demo
```

Run the original bounded text response after reviewing the fixed synthetic context in `live-demo.mjs`:

```bash
curl http://127.0.0.1:18120/api/demo \
  -H 'Origin: http://127.0.0.1:18120' \
  -H 'Content-Type: application/json' \
  --data '{"role_id":"account-executive","case_id":"baseline"}'
```

Run the fixed streaming and read-only tool workflow:

```bash
curl -N http://127.0.0.1:18120/api/workflow \
  -H 'Origin: http://127.0.0.1:18120' \
  -H 'Content-Type: application/json' \
  --data '{"role_id":"account-executive"}'
```

The streaming route emits named server-sent events. The first provider call must request exactly one `lookup_northstar_account` tool use for `northstar-freight`. The application checks its fixed synthetic caller scope, returns the bundled records, and sends one matching tool result. A second provider call streams the draft. Completion requires `message_stop`, `end_turn`, and the application checks recorded in the final event.

The route makes no customer-system request and performs no write. A completed generation is still a draft for human source review.

## Limits and failure handling

The text demo and contextual Ask path use one provider call. The workflow reserves two provider calls and permits one local read-only lookup. They share the persisted daily provider-call allowance and the two-call concurrency limit.

Each provider call has one attempt. The SDK retry count is zero. The workflow has one total deadline and stops on invalid tool input, a mismatched tool ID, a second tool request, incomplete streaming, client disconnect, or a provider error. Partial text does not count as completion.

The same-origin check protects the browser route. It is not employee authentication. A production application must authorize the employee and account before retrieving records or calling a model.

## Checks

```bash
npm run check
npm test
```

The tests inject SDK streams and provider responses. They make no paid model calls. Compare the code with the [streaming guide](../../docs/streaming-lab.md), the [live tool guide](../../docs/live-stream-tool-demo.md), and the [supporting features guide](../../docs/supporting-features.md).
