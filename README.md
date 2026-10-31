# Learn Claude workshop

This repository contains the complete public source for [learn.fluxcapacitor.dev](https://learn.fluxcapacitor.dev), plus standalone labs and teaching references. Northstar Freight, its records, people, identifiers, traces, and decisions are fictional.

The workshop uses one source set and one review standard across its audience paths. Engineers trace typed events, tool input, authorization, and failure boundaries. Account Executives check the same draft against its sources and decide whether it is ready for account planning. Generated drafts always require human source review.

## Skills, tools, and MCP example

Start with the [Northstar Skill and MCP example](docs/skills-tools-example.md). It separates the renewal procedure, application access checks, a local MCP tool, and native Skill execution. Each lab records what actually ran and which parts remain prepared teaching material.

The workshop uses documented Claude and MCP interfaces. The Northstar case, role exercises, application controls, and tests are maintained in this repository. Protocol explanations adapt the cited vendor documentation. See [sources and attribution](docs/source-and-attribution.md) for that distinction.

## Run the app

Use Node.js 22 or later. Start this block in the parent directory where you want the new checkout. The app runs in a subshell, so stopping the server returns you to that parent directory.

```bash
git clone https://github.com/cfregly/learn-claude-workshop.git
(
  cd learn-claude-workshop/app
  npm ci
  npm start
)
```

For every independent section below, start in the cloned repository root, `learn-claude-workshop/`. Use a separate terminal while the server is running.

Open `http://127.0.0.1:18120`. The site, replay, and offline materials work without an API key. Live features remain unavailable until the server receives approved `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` environment settings. Keep credentials out of source files and shell history.

For local live use, start at the repository root and point the bounded usage record to a writable ignored directory before starting the server. This subshell keeps the app working directory and environment separate from your parent shell:

```bash
(
  cd app
  export MODEL_BUDGET_FILE="$PWD/.local/model-usage.json"
  npm start
)
```

## Replay and Live

Replay is the repeatable teaching route. It uses fixed synthetic events, needs no API key, and includes happy, unauthorized, and interrupted cases.

Live streams two real Claude Messages API responses. Between those calls, the application executes one read-only lookup against the bundled synthetic Northstar fixture. The lookup accepts only the fixed `northstar-freight` account. It does not connect to a CRM, read customer data, change a record, send a message, approve pricing, or take a customer action.

The original text-only starter remains in [labs/claude_api_demo.py](labs/claude_api_demo.py). It is separate from both the prepared replay and the two-call live tool workflow.

## Python streaming lab

The Python lab is offline by default. Start this independent setup block at the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-live.txt
python labs/live-stream-tool-demo.py
```

From the repository root, with the virtual environment active and approved `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` environment values set, opt into the bounded live path:

```bash
python labs/live-stream-tool-demo.py --live
```

Live mode makes at most two provider calls and one local read-only synthetic lookup. It preserves unknowns, stops on incomplete protocol states, and returns a draft for human review. See the [live streaming guide](docs/live-stream-tool-demo.md) for the event and failure contract.

## Source layout

- `app/` contains the runnable server, browser interface, served materials, package lock, and focused tests.
- `docs/` contains the teaching guides rendered by the site and readable from the repository.
- `labs/` contains the offline text starter, the Python streaming and tool lab, fixtures, integration examples, and the standalone backend lab.
- `requirements-live.txt` pins the Python SDK used by the streaming lab.
- `labs/mcp/renewal-review/` contains the standalone read-only MCP lab and local smoke.
- `labs/skills/renewal-brief/` contains the Skill bundle, offline checks, and opt-in native API runners.
- `requirements-mcp.txt` and `requirements-skills.txt` pin the respective top-level SDK versions. They do not lock transitive dependencies.

The copies under `app/public/materials/` are the files served by the app. Their matching `docs/` and `labs/` paths are the repository entry points linked from the interface.

## Checks

Start at the repository root for the app checks. The subshell returns to that directory when the commands finish:

```bash
(
  cd app
  npm ci
  npm run check
  npm test
)
```

Start this independent block at the repository root for the standalone backend checks:

```bash
(
  cd labs/live-api
  npm ci
  npm test
)
```

The JavaScript tests inject provider responses and make no paid model calls. The default Python clients use synthetic data and make no network calls.

## Direct runtime boundary

Publishing this repository does not update the running app. Runtime integration needs its own source sync, focused checks, and readback.
