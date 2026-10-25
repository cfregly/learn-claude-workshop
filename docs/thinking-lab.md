# Northstar thinking lab

Prepare a reviewed renewal brief from approved Northstar records. The application owns access, tools, source receipts, budgets, and release. This lab uses saved objects, makes no API call, and contains no credential or replayable signature.

## Plain explanation

Thinking can help with a difficult task. It is neither the final answer nor proof that a tool read the right source. Check the selected model through the Models API. Do not apply older `budget_tokens` examples to every model.

## Five checks

### 1. Check the selected model

Read `capabilities.thinking.types` from `GET /v1/models/{model_id}` or the [saved workshop snapshot](https://learn.fluxcapacitor.dev/#material/model-capabilities). Do not infer from the model name.

```json
{
  "observed_at": "2026-10-25",
  "models": [
    {
      "id": "claude-sonnet-5-5",
      "capabilities": {
        "thinking": {
          "types": {
            "adaptive": { "supported": true },
            "between_tools": { "supported": true },
            "disabled": { "supported": false },
            "enabled": { "supported": false }
          }
        }
      }
    },
    {
      "id": "claude-opus-5-5",
      "capabilities": {
        "thinking": {
          "types": {
            "adaptive": { "supported": true },
            "between_tools": { "supported": false },
            "disabled": { "supported": false },
            "enabled": { "supported": false }
          }
        }
      }
    }
  ]
}
```

Sonnet 5.5 accepts `between_tools` at `high` effort or below. That mode takes no `display` field. Opus 5.5 uses adaptive thinking and rejects `disabled`.

### 2. Separate effort from the output limit

`output_config.effort` is soft guidance. `max_tokens` caps thinking and response text combined. Inspect `usage.output_tokens_details.thinking_tokens`, while treating total `usage.output_tokens` as authoritative. On `max_tokens`, lower effort for overthinking or raise the bounded cap when reasoning was needed.

```json
{
  "model": "claude-sonnet-5-5",
  "max_tokens": 900,
  "thinking": {
    "type": "between_tools"
  },
  "output_config": {
    "effort": "high"
  },
  "messages": [
    {
      "role": "user",
      "content": "Draft a source-bound Northstar renewal brief. Keep unknowns visible."
    }
  ]
}
```

### 3. Choose what the interface displays

`summarized` returns a reasoning summary, never raw chain of thought. `omitted` returns an empty thinking field plus its signature but still bills thinking tokens. Beta `updates` exposes progress notes while reasoning stays hidden. Never use an optional update as workflow state or a source receipt.

### 4. Keep three artifacts separate

- **Progress narration:** model text for the person watching.
- **Backend tool receipt:** application evidence that `read_approved_records` returned SUPPORT version `2026-10-13` for an authorized caller.
- **Final answer:** the source-linked renewal brief in a text block.

Only the backend proves which tool ran and which record returned. Finished generation can still miss required fields or sources.

### 5. Preserve thinking blocks during tool use

Within a tool-use turn, echo every thinking or redacted-thinking block and signature exactly as received. Do not parse, edit, reorder, or partly drop them.

```json
{
  "assistant_turn": {
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "",
        "signature": "<opaque signature returned by the API>"
      },
      {
        "type": "tool_use",
        "id": "toolu_northstar_demo",
        "name": "read_approved_records",
        "input": {
          "account_id": "northstar-freight"
        }
      }
    ]
  },
  "tool_result_turn": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_northstar_demo",
        "content": "SUPPORT version 2026-10-13, case 4821 open"
      }
    ]
  }
}
```

The signature is a non-replayable placeholder. Production code passes the returned opaque block unchanged.

## Two learner routes

**Engineer:** Verify capabilities and budget, distinguish progress from the receipt, and show the unchanged tool round trip.

**Architect:** Choose model, mode, effort, display, output cap, observability, and release check. Defend latency and cost without treating hidden thinking as free.

## Completed reference

The workshop uses Sonnet 5.5, `between_tools`, `high` effort, a 900-token cap, and no `display` field. Opus 5.5 uses adaptive, not `disabled`. Record total and thinking tokens. Trust the backend receipt. Require every final field and source. Echo thinking and signature blocks unchanged during tool use.

## Changed case

The response reaches `max_tokens` before the complete brief. A reviewer claims `display: "omitted"` made reasoning free. Another request sends Opus 5.5 with `thinking.type: "disabled"`.

Mark the brief incomplete and run a fresh bounded case. Correct cost with usage data. Reject the unsupported configuration before sending it.

## Business value and rejoin

Reasoning can improve the task without becoming account evidence.

**Exact rejoin checkpoint:** The engineer names the capability, terminal state, receipt, and unchanged block. The architect names mode, effort, cap, display, and release condition. Both must state that completed generation still needs every required field and source check.

## Official Anthropic references

- [Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)
- [Steering thinking and cost](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)
- [Models API](https://platform.claude.com/docs/en/api/models)
- [Models overview and capabilities](https://platform.claude.com/docs/en/models/overview)
- [Reviewed workshop capability snapshot](https://github.com/cfregly/northstar-workshop/blob/main/docs/model-capabilities.json)
