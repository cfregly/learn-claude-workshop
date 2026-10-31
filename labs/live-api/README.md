# Northstar live Claude API lab

This folder is a bounded snapshot of the backend lab extracted from the runnable app in `../../app/`. It contains its own server handler, Claude SDK dependency, fixed synthetic role context, usage controls, and backend tests. All Northstar records are fictional.

Use this snapshot to inspect the request boundary. Use `../../app/` for the current full browser interface and native integration. This folder omits those features, and its handler and tests do not have full app parity.

Important Ask differences:

- The app accepts an optional learner-selected excerpt and request bodies up to 100 KiB. This snapshot does not accept selected excerpts and limits request bodies to 10 KiB.
- The app preserves Ask answer text beyond 180 words when the provider returns `end_turn`. This snapshot shortens answers to 180 words and marks a shortened result incomplete, even when the provider returns `end_turn`.
- The native integration route and its Ask context are available in the app and absent from this snapshot.

## Run

Use Node.js 22 or later. From the repository root, first run `cd labs/live-api`. If you downloaded only this folder, open a terminal in that folder. Run the commands below from the lab folder.

```bash
npm ci
export MODEL_BUDGET_FILE="$PWD/.local/model-usage.json"
npm start
```

Without approved `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` environment settings, the health and capability endpoints remain available while generation stays unavailable. Do not commit credentials.

Keep the server running. In a second terminal, inspect capability:

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

Run these commands from `labs/live-api`, the same folder used for setup and startup:

```bash
npm run check
npm test
```

The tests inject SDK streams and provider responses. They make no paid model calls. Compare the code with the [streaming guide](../../docs/streaming-lab.md), the [live tool guide](../../docs/live-stream-tool-demo.md), and the [supporting features guide](../../docs/supporting-features.md).
