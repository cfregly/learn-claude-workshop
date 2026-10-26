# Learn Claude workshop

A role-based Claude workshop at https://learn.fluxcapacitor.dev. Northstar Freight is the fictional account shared across all twelve paths.

Choose your role, complete a familiar task, inspect a demonstration, make an artifact, and explain its evidence. The selected learning goal stays at the top of each lesson. Use a worked example when blocked and test a changed assumption when ready.

Business roles use Claude for Work. Engineers use the direct Claude Messages API. Leaders make a decision with conditions and ownership. Both self-paced learners and live facilitators use the same records and return points.

## Develop on piq-runtime

The live editable source is `/opt/learn-claude-workshop/app`. Connect with `ssh piq-runtime-ssm`. Static changes appear on refresh. Node watches the backend and course content. Run `npm run check` and `npm test` in that folder for a short check.

The independent `learn-claude-workshop.service` serves loopback port 18120 through the existing Cloudflare route. Its user, configuration, model budget, and restarts are separate from other apps. Cloudflare bypasses caching only for learn.fluxcapacitor.dev. Normal edits need no release package or DNS change.

The API key stays in root-owned `/etc/learn-claude-workshop-api.env`. The service reads it. Never place a key in public files or a repository. Both the live demonstration and contextual Ask share the existing 100-call daily allowance, two concurrent calls, and bounded output and deadlines.

### Native MCP Python

The native MCP example uses the workshop-owned `/opt/learn-claude-workshop/venv-mcp`. Build it with the Amazon Linux interpreter at `/usr/bin/python3.11`. Do not use the host's default `/usr/bin/python3`, which is Python 3.9, or a Python runtime managed by another app.

Create a staging virtual environment beside the current one. Install `/opt/learn-claude-workshop/requirements-mcp.txt` from `https://pypi.org/simple` with isolated pip, no cache, no retries, and no input. Run `pip check`, verify `mcp==2.3.0`, and complete the fixed read-only MCP boundary smoke as `learn-claude-workshop` before replacing the current environment. Keep the previous environment as a reversible backup until the new path passes the same service-user smoke. The Python child receives a scrubbed environment with no API credential.

## What runs

The optional live example and Ask call Claude with synthetic account context. Source review and working artifacts remain part of the lesson. Working drafts stay in the learner's browser and are not sent automatically.

Follow the request is an annotated prepared streaming and tool-use trace. The optional thinking and supporting-features guides cover citations, schemas, prompt caching, memory, Skills, programmatic tool calling, advisor, and token counting. Their reference examples are prepared teaching material. They do not claim those advanced features were executed by the live app.

The public code and source notes live in https://github.com/cfregly/learn-claude-workshop. The workshop renders them inline and links to the matching GitHub version. The Northstar filenames identify the fictional case, not a separate app.

References open over the current lesson so the learner can return to the same draft or trace. Code has syntax highlighting, wraps within the view, and copies as plain source. Select a passage or use a panel’s Ask button to add visible context to a question. The excerpt can be removed, and no question is sent until the learner presses Ask Claude.

## Diagnose a stalled draft

Open the diagnosis lab from the technical demonstration or activity. Eight synthetic packets trace Claude SSE, the backend parser and relay, browser delivery, application state, and visible UI. Learners record a boundary, one discriminating check, and a repair with customer-visible verification before opening the completed reference. A small parsed-payload simulation tests append versus replace. The selected role changes the goal. Facilitator view exposes the instructor key and rubric. All packet timings, IDs, failures, and receipts are synthetic, not API measurements or wire replay fixtures.

The optional hooks lesson separates direct application authorization from Claude Code and Agent SDK lifecycle hooks, HTTP middleware, and asynchronous notifications. Its standard-library dispatcher is a synthetic offline exercise, with no customer or provider calls.
