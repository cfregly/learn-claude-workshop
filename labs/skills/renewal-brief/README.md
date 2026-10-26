# Native renewal brief Skill

This lab packages a real custom Skill and provides an opt-in invocation path through Anthropic's GA Skills API. It does not copy `SKILL.md` into a system prompt and call that Skill use.

No upload or provider inference was performed while building this lane. The opt-in workshop owner performs those actions with an approved workspace, credentials, budget, and private receipt directory.

## Mechanism

The live path follows the current official API shape checked October 26, 2026:

1. `renewal_skill.upload` stages only the allowlisted Skill files and calls `client.skills.create`, or `client.skills.versions.create` for an explicitly named existing Skill.
2. It records the provider-returned Skill ID, version ID, SDK version, and exact local bundle hash in a private pin receipt. Version ID formats may change, so the code preserves the returned value without inventing a prefix.
3. `renewal_skill.run_live` recomputes the bundle hash and rejects any drift from the pin.
4. It makes one Messages API call with the pinned custom Skill in `container.skills`, `code_execution_20260521`, and `output_config.effort=max`.
5. It requires paired successful server tool results for reading the installed `SKILL.md`, hashing the mounted executable files, and running the bundled deterministic renderer.
6. It compares the renderer's input and output hashes with local deterministic results. Narration alone cannot pass.

Official sources:

- [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Using Agent Skills with the API](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- [Create Skill API](https://platform.claude.com/docs/en/api/python/skills/create)
- [Create Skill Version API](https://platform.claude.com/docs/en/api/python/skills/versions/create)
- [Messages API](https://platform.claude.com/docs/en/api/messages/create)
- [Code execution tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
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

Offline tests cover all four synthetic fixtures, untrusted instructions, date conflicts, access denial, strict upload staging, pin drift, exact returned model checks, and sanitized native-Skill proof.

Independent critique and review use the Claude Code subscription. Do not spend Anthropic API calls on critique. The opt-in API commands below are reserved for the workshop in-app feature validation, subject to owner approval.

## Optional application-orchestrated MCP read

The application can fetch the declared synthetic record before calling the model. The model does not select or call MCP in this flow.

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

The uploader makes exactly one Skills API call and configures SDK retries to zero. It does not persist a raw API response or credential.

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

Each command makes exactly one Messages API call. SDK retries are zero. A `pause_turn`, output limit stop, API error, model mismatch, missing resolved Skill pin, missing paired result, mounted-file hash mismatch, or missing script proof fails without a retry or fallback. Internal code execution can contain several steps. The evidence counts every returned server tool step. The run passes only with `stop_reason=end_turn`.

Max effort can consume a 4096 token output budget before tool execution. The runner therefore allows an owner-selected cap up to 16384 and uses 16384 in this bounded example. It never increases the cap or repeats the request automatically.

The API response returns the actual model. The runner requires an exact match. It requests `max` through `output_config.effort` and records any returned effort field. When the Message schema does not echo effort, the evidence says that the API accepted the request parameter without claiming an echoed value. There is no silent downgrade.

`max_tokens` bounds model output. It is not a strict dollar guarantee. The owner must apply workspace budget controls and review provider usage separately.

## Evidence and limits

Evidence contains the returned model, requested and echoed effort state, resolved Skill ID and version, container ID, usage, hashed commands, code execution step count, mounted-script hash checks, renderer marker from paired server tool result stdout, deterministic output, and proof verdict. If the response echoes an effort other than `max`, proof fails.

Evidence excludes hidden thinking, full command text, unrelated stdout, the API key, raw HTTP headers, and the raw response. The contract accepts only records that explicitly declare they are synthetic.

Custom Skills uploaded through the API are workspace-wide. Skills and code execution are not a zero-data-retention path. The code execution container has no network access and cannot install packages at runtime. Review the official retention and workspace-isolation guidance before the opt-in upload.

The local pin proves which allowlisted bytes were offered to the upload request and which Skill ID and version the provider returned. The live receipt checks the mounted `SKILL.md` and executable file hashes against that pin. This is narrow execution evidence, not a general cryptographic attestation of provider storage.

The deterministic extractor is designed for the four fixture formats in `labs/source-fixtures.json`. It exists to make native Skill protocol execution observable and testable. It is not general renewal automation, and its deterministic work does not require an LLM.

A passing live receipt provides evidence of a native custom Skill read and bundled-script execution against a record declared synthetic. The offline implementation alone does not make that claim. Neither state proves a live CRM read, model-selected MCP use, real authorization, authentication, a sent message, a CRM write, a customer commitment, or deployment. The embedded source IDs are labels in the fixture text, not external source reads. The actor ID is a synthetic host-selected value.
