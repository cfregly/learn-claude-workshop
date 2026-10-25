# Extend the renewal workflow

Use this guide after learners can name the shared workflow: select approved records, ask Claude for a source-bound draft, review it against the records, then use the reviewed output. These sections are optional extensions, not beginner prerequisites.

Every object below is prepared and synthetic. No example called a model, read a customer system, changed a record, or approved an action. Recheck compatibility when you implement. For reasoning controls, use the local [thinking lab](https://learn.fluxcapacitor.dev/#material/thinking-lab).

## 1. Citations for supported claims

**Familiar task.** A reviewer asks, “Where did the renewal date come from, and do we know that SSO is included?”

**Plain explanation.** Native citations connect response text to locations in supplied documents. They show source support. They do not prove that a source is current, fill a missing fact, or authorize action.

**Prepared demo.** This inline document supports the date and discount discussion. It contains no SSO entitlement fact.

```json
{
  "type": "document",
  "source": {
    "type": "text",
    "media_type": "text/plain",
    "data": "[CRM] Northstar Freight renews January 31, 2027. [CALL] A 12 percent discount was discussed. Approval is not recorded."
  },
  "title": "Approved Northstar source excerpts",
  "citations": {
    "enabled": true
  }
}
```

The prepared answer cites the date, labels discount approval as missing, and keeps SSO entitlement unknown. Citation responses use typed text blocks. Business learners inspect claims and gaps. Engineers inspect blocks. Architects confirm which approved documents may enter the request.

**Value and learning check.** Ask the learner to point to evidence for each customer claim, then name one thing a citation cannot authorize.

**Completed reference and exact rejoin.** Renewal is January 31, 2027, sourced to CRM. Twelve percent was discussed, but approval is missing. SSO entitlement is unknown. **Rejoin:** “The cited date is supported, and the two missing facts remain missing.”

**Changed case.** Remove the CRM sentence with the renewal date. The learner must move the date to unknowns instead of repeating it without support.

## 2. Structured outputs and strict tool inputs

**Familiar task.** Revenue Operations needs a predictable renewal card, while the account tool needs correctly typed input.

**Plain explanation.** `output_config.format` constrains final JSON. `strict: true` constrains a tool name and input against its schema. Schema validity does not prove a fact, grant access, approve a discount, or prove a write.

**Prepared demo.** The output schema preserves a three-state approval field instead of forcing an unsupported yes or no.

```json
{
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": {
          "renewal_date": { "type": "string" },
          "discount_status": {
            "type": "string",
            "enum": ["approved", "not_approved", "unknown"]
          },
          "missing_facts": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["renewal_date", "discount_status", "missing_facts"],
        "additionalProperties": false
      }
    }
  }
}
```

Citations cannot be combined with `output_config.format`. First review cited text. Then send approved evidence to a separate structured-output step. Business learners verify meaning. Engineers distinguish final-response schema from strict tool-input schema. Architects explain the staged handoff.

**Value and learning check.** Ask which control catches a string where an integer was required, and which control proves the discount was approved. The second answer is “neither.”

**Completed reference and exact rejoin.** The prepared card uses `unknown`, lists SSO entitlement and discount approval as missing, and triggers no action. **Rejoin:** “The JSON is valid, its claims are reviewed, and authorization is still an application decision.”

**Changed case.** Replace the status enum with a boolean. The learner must reject the lossy schema because blank approval cannot be represented truthfully.

## 3. Prompt caching and truthful cost

**Familiar task.** The same source pack and instructions appear in many renewal questions.

**Plain explanation.** Prompt caching can reuse an eligible, identical prefix. Put stable tools, instructions, and source context first. A change before the breakpoint can miss. Minimum length depends on the model. On October 25, 2026, Sonnet 5.5 and Opus 5.5 require 512 tokens.

**Prepared demo.** These are synthetic usage objects, not observed billing records.

```json
{
  "first_request": {
    "input_tokens": 180,
    "cache_creation_input_tokens": 720,
    "cache_read_input_tokens": 0,
    "output_tokens": 140
  },
  "second_request": {
    "input_tokens": 90,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 720,
    "output_tokens": 132
  }
}
```

Do not claim a blanket 90 percent overall cost reduction. Writes, reads, uncached input, output, TTL, and model prices differ. Business learners report line items. Engineers inspect both cache usage fields. Architects choose the TTL, breakpoint, and evaluation.

**Value and learning check.** Ask what a nonzero cache-read field proves. It proves eligible input was read from cache for that request, not that the whole request became 90 percent cheaper.

**Completed reference and exact rejoin.** The first fixture writes 720 tokens. The second reads 720. Cost remains an estimate until current prices and actual usage are applied. **Rejoin:** “The reusable prefix is identical, the usage fields show the cache event, and output cost remains separate.”

**Changed case.** Change the source date before the breakpoint. Predict a miss, inspect usage or cache diagnostics, and move volatile material after the stable prefix when the task permits.

## 4. App-owned memory

**Familiar task.** A user asks the renewal assistant to remember that unknowns must stay visible next time.

**Plain explanation.** `memory_20250818` is a client tool. Claude requests file operations. The application stores, isolates, expires, and deletes data. This is application memory, not prompt caching.

**Prepared demo.** The consent and policy fields belong to the fictional application layer.

```json
{
  "tool": { "type": "memory_20250818", "name": "memory" },
  "application_record": {
    "tenant_id": "tenant_northstar_demo",
    "user_id": "employee_42",
    "path": "/memories/renewal-preferences.json",
    "consent_id": "consent_demo_004",
    "provenance": ["user instruction, October 25"],
    "retention_until": "2026-11-30",
    "value": { "keep_unknowns_visible": true }
  }
}
```

Business learners ask for memory consent and can request deletion. Engineers map `/memories` to tenant-isolated storage, preserve provenance, reject path traversal, and test deletion. Architects set access, retention, recovery, audit, and tenant boundaries.

**Value and learning check.** Ask who owns the stored bytes and who enforces deletion. The application owns both responsibilities.

**Completed reference and exact rejoin.** The preference is stored only after consent, under one tenant and user, with provenance and expiry. **Rejoin:** “The app served the same isolated store, and the user can inspect or delete it.”

**Changed case.** A request arrives with the same path but a different tenant ID. Deny the operation. Do not use a shared directory or rely on the model to enforce isolation.

## 5. Versioned Skills

**Familiar task.** A team wants every renewal brief to follow the same reviewed checklist.

**Plain explanation.** A Skill packages instructions, resources, and optional scripts. In the Claude API, Skills run in a code execution container and are selected through `container.skills`. Pin a reviewed version for repeatable behavior. A Skill is procedure, not permission or source evidence.

**Prepared demo.** Read the [reviewed renewal-brief SKILL.md](https://learn.fluxcapacitor.dev/#material/renewal-skill), then apply its procedure to the same four source records. It names when to use the Skill, the required checks, and the review boundary. The API IDs below are synthetic. The request shape uses a pinned custom version and compatible code execution.

```json
{
  "container": {
    "skills": [
      {
        "type": "custom",
        "skill_id": "skill_northstar_renewal_demo",
        "version": "skver_2026_10_25_demo"
      }
    ]
  },
  "tools": [
    { "type": "code_execution_20250825", "name": "code_execution" }
  ]
}
```

API Skills have no network access and cannot directly read a CRM. The application supplies approved inputs or separate authorized tools. Business learners review the checklist. Engineers record the resolved version and validate output. Architects vet the bundle, workspace, compatibility, and rollback.

**Value and learning check.** Ask what pinning adds. It gives a named procedure version to test and recover. It does not freeze the model, approve facts, or grant CRM access.

**Completed reference and exact rejoin.** The prepared request names one reviewed Skill version and code execution. No external system is contacted. **Rejoin:** “The version is pinned, its output is reviewed, and application access remains separate.”

**Changed case.** Replace the pinned version with `latest`, then discover a changed checklist. Restore the tested version and evaluate the new one before promotion.

## 6. Advanced read-only programmatic tool calling

**Familiar task.** An authorized employee needs to find a few renewal accounts across many permitted records without loading every record into model context.

**Plain explanation.** Programmatic tool calling lets Claude write code in a supported code execution container, call application tools, and filter intermediate results before returning a smaller result. Keep this exercise read-only. `allowed_callers` guides how the tool is called. It is not an authorization boundary.

**Prepared demo.** This teaching envelope shows Messages API tools beside application policy. The application authorizes every account ID before execution and caps fan-out at eight. Each result carries source IDs.

```json
{
  "messages_api": {
    "tools": [
      { "type": "code_execution_20260120", "name": "code_execution" },
      {
        "name": "read_account_snapshot",
        "description": "Read one authorized synthetic account and return JSON with source_ids.",
        "allowed_callers": ["code_execution_20260120"],
        "input_schema": {
          "type": "object",
          "properties": { "account_id": { "type": "string" } },
          "required": ["account_id"],
          "additionalProperties": false
        }
      }
    ]
  },
  "application_policy": {
    "mode": "read_only",
    "max_account_ids": 8,
    "authorized_account_ids": ["acct_northstar"]
  }
}
```

Business learners see candidates with supported reasons and no customer action. Engineers inspect `caller`, container reuse, source IDs, timeout handling, and the authorization check. Architects bound fan-out, isolate tenants, and evaluate recovery. Compare ordinary direct calls and programmatic calls with the same fixtures. Record actual answer quality, latency, and cost. Do not assume savings.

**Value and learning check.** Ask what prevents access to `acct_aurora`. The application allowlist does. `allowed_callers` does not.

**Completed reference and exact rejoin.** One authorized Northstar record is read, filtered, and returned with source IDs. No write tool exists. **Rejoin:** “The caller is identified, every account passed app authorization, and only source-bound results reached the model.”

**Changed case.** Supply nine IDs or one unauthorized ID. Stop before that tool call, preserve the denial receipt, and report the bounded partial result.

## 7. Advanced advisor

**Familiar task.** A faster executor needs one strategic review of a difficult renewal-plan draft.

**Plain explanation.** The beta advisor tool lets an executor model consult a compatible advisor inside one Messages request. It can improve a plan. It cannot provide human approval, customer consent, or source evidence.

**Prepared demo.** As documented on October 25, 2026, Claude Sonnet 5 with Claude Opus 5.5 is an allowed pair. Verify the compatibility table again before use.

```json
{
  "headers": { "anthropic-beta": "advisor-tool-2026-03-01" },
  "body": {
    "model": "claude-sonnet-5",
    "max_tokens": 900,
    "tools": [
      {
        "type": "advisor_20260301",
        "name": "advisor",
        "model": "claude-opus-5-5",
        "max_uses": 1,
        "max_tokens": 1024
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "Review a source-bound Northstar renewal plan. Preserve missing approval and SSO facts."
      }
    ]
  }
}
```

The result may be an opaque `advisor_redacted_result` that the executor can use even when the client cannot read it. Business learners still require the named approver. Engineers round-trip result blocks and enforce caps. Architects verify the model pair, budget, retention, failure behavior, and measured lift.

**Value and learning check.** Ask whether an advisor result can approve the 12 percent discount. It cannot.

**Completed reference and exact rejoin.** One compatible advisor call is allowed, bounded, and treated as guidance. **Rejoin:** “The executor used advice, the evidence stayed unchanged, and the human approval gate remains open.”

**Changed case.** Use an incompatible pair or exceed `max_uses`. Handle the error, continue safely, and do not invent advice or approval.

## 8. Compatible input token counting

**Familiar task.** A developer wants to know whether an inline Northstar request fits before sending it.

**Plain explanation.** `POST /v1/messages/count_tokens` estimates eligible input tokens. It does not estimate output tokens, calculate a bill, or perform prompt caching. The count can differ slightly from actual Messages usage.

**Prepared demo.** Count a standalone inline fixture with a client tool schema. Keep PTC and Skills out of this count fixture.

```json
{
  "model": "claude-sonnet-5-5",
  "system": "Use only supplied synthetic Northstar records.",
  "messages": [
    {
      "role": "user",
      "content": "Draft confirmed facts, unknowns, and proposed internal actions."
    }
  ],
  "tools": [
    {
      "name": "read_account_record",
      "description": "Read one authorized synthetic account.",
      "input_schema": {
        "type": "object",
        "properties": { "account_id": { "type": "string" } },
        "required": ["account_id"],
        "additionalProperties": false
      }
    }
  ]
}
```

The endpoint accepts client tools and advisor. It rejects other server tools, the MCP connector, and image or document inputs that use `url` or `file` sources. Send supported inline or base64 inputs when counting. For PTC, Skills, and other server-tool workflows, inspect actual `usage` from the Messages response.

Business learners call the number an estimate. Engineers check endpoint compatibility and input shape. Architects compare the estimate with actual usage across representative fixtures before setting budgets.

**Value and learning check.** Ask what `input_tokens` predicts. It predicts eligible input size only.

**Completed reference and exact rejoin.** The inline fixture is count-compatible, and no generation or action occurs. **Rejoin:** “The request fits the chosen input budget, and actual Messages usage will decide cost.”

**Changed case.** Add code execution and a Skill to the count request. Recognize the incompatible fixture, remove it from preflight counting, and use actual Messages usage for that evaluated path.

## Official Anthropic references

- [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use)
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Using Agent Skills with the API](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- [Programmatic tool calling](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)
- [Advisor tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool)
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)
