# Native renewal brief Skill

This lab packages a real custom Skill and provides an opt-in invocation path through Anthropic's GA Skills API. It does not copy `SKILL.md` into a system prompt and call that Skill use.

No upload or provider inference was performed while building this lane. The opt-in workshop owner performs those actions with an approved workspace, credentials, budget, and private receipt directory.

Status: source and offline tests only. No Skill upload or Messages call has run. The runner has not yet been checked against a recorded provider response.

The official pages linked below document the Skill mount path, returned container Skill fields, code execution tool version, exact model IDs, and `max` effort. This repository has not yet observed those fields in its own live receipt.

## Mechanism

The configured path follows the current official API shape checked October 26, 2026:

1. `renewal_skill.upload` stages only the allowlisted Skill files and calls `client.skills.create`, or `client.skills.versions.create` for an explicitly named existing Skill.
2. It records the provider-returned Skill ID, version ID, SDK version, and exact local bundle hash in a private pin receipt. Version ID formats may change, so the code preserves the returned value without inventing a prefix.
3. `renewal_skill.run_live` recomputes the bundle hash and rejects any drift from the pin.
4. It is designed to invoke `messages.create` once with the pinned custom Skill in `container.skills`, `code_execution_20260521`, and `output_config.effort=max`.
5. It requires paired successful server tool results for reading the installed `SKILL.md`, hashing the mounted executable files, and running the bundled deterministic renderer.
6. It compares the renderer's input and output hashes with local deterministic results. Narration alone cannot pass.

Official sources:

- [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Using Agent Skills with the API](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- [Create Skill API](https://platform.claude.com/docs/en/api/python/skills/create)
- [Create Skill Version API](https://platform.claude.com/docs/en/api/python/skills/versions/create)
- [Messages API](https://platform.claude.com/docs/en/api/messages/create)
- [Code execution tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- [Effort](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview)
- [Claude Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview)
- [Anthropic Python SDK releases](https://github.com/anthropics/anthropic-sdk-python/releases)

## Strict bundle

Only these files are uploaded:

- `SKILL.md`
- `references/OUTPUT_CONTRACT.md`
- `scripts/contract.py`
- `scripts/render_brief.py`

README files, tests, upload and live runner modules, environments, credentials, pin files, receipts, and local outputs are never staged. The pin hash binds path, length, and bytes for each allowlisted file.

## Offline setup and tests

From the repository root:

```bash
python3 -m venv .venv-skills
.venv-skills/bin/pip install -r requirements-skills.txt
.venv-skills/bin/python -m unittest discover -s labs/skills/renewal-brief/tests -v
```

Offline tests cover all four synthetic fixtures, the observed MCP smoke result contract, untrusted instructions, date conflicts, access denial, strict upload staging, pin drift, exact returned model checks, and sanitized native-Skill proof.

## Optional application-orchestrated MCP read

The operator can export the local MCP smoke result to a file and pass that file to the runner. The runner treats it as caller-supplied and cannot tell whether it came from MCP. The model does not select or call MCP in this flow.

From the repository root, after the MCP lane is installed:

```bash
/tmp/renewal-review-mcp-venv/bin/python labs/mcp/renewal-review/smoke.py \
  --python /tmp/renewal-review-mcp-venv/bin/python \
  --export /tmp/northstar-mcp-result.json
```

The live runner accepts only the agreed seven fields. It rejects an `expected` answer key, extra fields, a false synthetic declaration, missing access confirmation, and `demo-no-access` before any provider call. This schema check does not establish that the data is actually synthetic. It does not prove authentication or authorization. The runner records the origin as `caller_supplied_synthetic_record` because it does not bind or validate an MCP receipt.

## Opt-in upload

Run this only in the approved workshop workspace. Keep the pin and provider receipts outside the public repository.

```bash
mkdir -p /tmp/renewal-skill-receipts
cd labs/skills/renewal-brief
../../../.venv-skills/bin/python -m renewal_skill.upload \
  --skill-root . \
  --pin-file /tmp/renewal-skill-receipts/skill-pin.json \
  --confirm-upload CREATE_OR_VERSION_WORKSPACE_SKILL
```

To create a new version of the same workspace Skill, add the real existing ID:

```text
--existing-skill-id skill_...
```

The uploader invokes one Skills SDK method and configures SDK retries to zero. A successful response is required before it writes a pin. It does not persist a raw API response or credential.

## Two opt-in native Skill runs

Use the same pin and MCP export for both exact models.

```bash
cd labs/skills/renewal-brief
../../../.venv-skills/bin/python -m renewal_skill.run_live \
  --skill-root . \
  --pin-file /tmp/renewal-skill-receipts/skill-pin.json \
  --records-file /tmp/northstar-mcp-result.json \
  --model claude-opus-5-5 \
  --effort max \
  --max-tokens 16384 \
  --evidence-file /tmp/renewal-skill-receipts/opus-5.5-max.json \
  --confirm-live RUN_ONE_NATIVE_SKILL_MESSAGE

../../../.venv-skills/bin/python -m renewal_skill.run_live \
  --skill-root . \
  --pin-file /tmp/renewal-skill-receipts/skill-pin.json \
  --records-file /tmp/northstar-mcp-result.json \
  --model claude-fable-5-1 \
  --effort max \
  --max-tokens 16384 \
  --evidence-file /tmp/renewal-skill-receipts/fable-5.1-max.json \
  --confirm-live RUN_ONE_NATIVE_SKILL_MESSAGE
```

Each command invokes `messages.create` once. SDK retries are zero. A `pause_turn`, output limit stop, API or local SDK error, model mismatch, missing resolved Skill pin, missing paired result, mounted-file hash mismatch, or missing script proof fails without a retry or fallback. Internal code execution can contain several steps. The evidence counts every returned server tool step. The run passes only with `stop_reason=end_turn`.

The runner allows an owner-selected output cap up to 16384 and uses 16384 in this bounded example. It never increases the cap or repeats the request automatically.

The API response returns the actual model. The runner requires an exact match. It requests `max` through `output_config.effort` and records any returned effort field. If the response does not echo effort, the runner cannot detect a server-side effort change. Evidence then records only that the request parameter was accepted.

`max_tokens` bounds model output. It is not a strict dollar guarantee. The owner must apply workspace budget controls and review provider usage separately. A client timeout does not prove that provider work stopped, and billing state can remain unknown.

## Evidence and limits

Evidence contains the returned model, requested and echoed effort state, resolved Skill ID and version, container ID, usage, hashed commands, code execution step count, mounted-file hash checks, renderer marker from paired server tool result stdout, deterministic output, and proof verdict. If the response echoes an effort other than `max`, proof fails. The live checker verifies three of the four mounted files. It reads and hashes `SKILL.md` and hashes both executable Python files. It does not read or hash `references/OUTPUT_CONTRACT.md` inside the container.

Evidence excludes hidden thinking, final model text, full command text, unrelated stdout, the API key, raw HTTP headers, and the raw response. It retains only the final text hash and character count. The contract accepts only records that explicitly declare they are synthetic.

Custom Skills uploaded through the API are [workspace-wide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview). The same official page states that API Skills have no network access and no runtime package installation. [Code execution data can be retained for up to 30 days](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool). These pages were checked October 26, 2026.

The local pin proves which allowlisted bytes were offered to the upload request and which Skill ID and version the provider returned. The live receipt checks the mounted `SKILL.md` and executable file hashes against that pin. This is narrow execution evidence, not a general cryptographic attestation of provider storage. Command matching cannot detect shell functions defined in earlier steps. The hash check and script run are separate, so they are not atomic. The trust anchor is the sandbox-produced tool result.

The deterministic extractor is designed for the four fixture formats in `labs/source-fixtures.json`. Its parser expects the specific English labels and sentence shapes documented in the output contract. It exists to make native Skill protocol execution observable and testable. It is not general renewal automation, and its deterministic work does not require an LLM.

A passing live receipt provides evidence of a native custom Skill read and bundled-script execution against a record declared synthetic. The offline implementation alone does not make that claim. Neither state proves a live CRM read, model-selected MCP use, real authorization, authentication, a sent message, a CRM write, a customer commitment, or deployment. The embedded source IDs are labels in the fixture text, not external source reads. The actor ID is a synthetic host-selected value.
