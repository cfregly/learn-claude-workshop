# Direct Claude API streaming lab

This ten minute Northstar replay uses prepared synthetic events. It makes no network request, calls no model, and performs no account action.

The event ordering and partial JSON explanations adapt the [official streaming documentation](https://platform.claude.com/docs/en/build-with-claude/streaming). The Northstar traces, task, and failure exercises apply those interfaces to this workshop. See [sources and attribution](source-and-attribution.md).

## Choose the replay or live route

- **Replay for repeatable teaching and failures.** Stay in this lab at [Streaming events](https://learn.fluxcapacitor.dev/#streaming). Run the same happy, unauthorized, and interrupted traces without a credential or provider call.
- **Live for provider streaming and one executed local lookup.** Open the [live streaming guide](https://learn.fluxcapacitor.dev/#material/live-stream-tool), then run the [Python starter](https://learn.fluxcapacitor.dev/#material/live-stream-tool-code). Live mode makes at most two Messages API calls and executes one read-only lookup against the bundled synthetic Northstar fixture. It does not connect to a CRM or change a customer record.

Both routes teach the same event, tool ID, authorization, and terminal-state boundaries. The replay is the stable baseline. The live route adds provider behavior, latency, usage, and possible API errors.

## Learning goal

Trace one direct Messages API tool cycle without confusing generation, application execution, and business completion.

By the end, a learner can:

1. Read a typed Message as ordered content blocks.
2. Append `text_delta` fragments into a cumulative text snapshot.
3. Keep `input_json_delta` fragments as a string until `content_block_stop`.
4. Parse the full JSON once and validate it against the client tool schema.
5. Check application account access before running a client tool.
6. Match a `tool_result.tool_use_id` to the original `tool_use.id`.
7. Separate `end_turn`, `message_stop`, backend confirmation, and source review.
8. Mark truncated or interrupted work as incomplete.

## Familiar task

Think about a delivery receipt. A scan can show that a package reached a sorting center. Another scan can show that it left. Neither scan proves that the recipient accepted the package. Each signal has a precise meaning.

The streaming lab applies the same habit to a customer renewal brief:

- A text fragment shows what the model emitted.
- A ping shows that the connection is alive.
- A model sentence such as “I will check the account” is model-authored text.
- An application dispatch record shows that client code started a tool.
- A backend receipt confirms the mocked tool result.
- `message_stop` confirms that one model stream ended.
- A human source check decides whether the customer brief is ready to use.

Do not invent a percent complete from token counts. The step number shows position in this prepared trace, not runtime progress.

## Request and application context

The prepared API request contains a system instruction, one user Message, a client tool definition, and `stream: true`.

```json
{
  "model": "claude-opus-5-5",
  "max_tokens": 600,
  "stream": true,
  "system": "Use only records returned by the account tool. State when approval evidence is missing.",
  "tools": [
    {
      "name": "read_account_record",
      "description": "Read selected fields from one account record after the application authorizes access.",
      "input_schema": {
        "type": "object",
        "properties": {
          "account_id": {
            "type": "string"
          },
          "fields": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "account_id",
          "fields"
        ],
        "additionalProperties": false
      }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Prepare a source-linked renewal brief for Northstar Freight. Include the owner, renewal date, discount status, SSO status, open support case, and weekly active users. Preserve unknowns and do not infer a cause from the usage change."
        }
      ]
    }
  ]
}
```

The application also has an employee account allowlist. That authorization context belongs to the application. It is not an extra Messages API field.

```json
{
  "actor_id": "employee_42",
  "authorized_account_ids": ["acct_northstar"],
  "source_record": "synthetic-crm/acct_northstar"
}
```

An API credential authorizes the API call. The account allowlist authorizes access to the customer record. Keep those checks separate.

## Typed Message and content blocks

A streamed response begins with `message_start`. Its `content` array is empty. Each content block then follows this sequence:

1. `content_block_start`
2. One or more `content_block_delta` events
3. `content_block_stop`

The block `index` identifies its position in the final Message content array. In the completed reference, index 0 holds text and index 1 holds `tool_use`. The following type union covers only those blocks in this prepared replay. It is not the complete API content-block type set.

```ts
type MessageContent = TextBlock | ToolUseBlock

type TextBlock = {
  type: 'text'
  text: string
}

type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
```

The raw text delta contains only the latest fragment:

```json
{
  "type": "content_block_delta",
  "index": 0,
  "delta": {
    "type": "text_delta",
    "text": "account record before drafting."
  }
}
```

The cumulative application snapshot joins all text deltas for block 0:

```text
I will check the authorized account record before drafting.
```

That sentence is model-authored narration. It does not prove that application code ran.

## Completed reference

Use this reference if a learner gets stuck. Rejoin at step 10.

| Step | Signal | Application interpretation |
| --- | --- | --- |
| 1 | `message_start` | The streaming response started after HTTP acceptance. |
| 2 | Text block starts at index 0 | Store text for the first content block. |
| 3 | First `text_delta` | Append the fragment. |
| 4 | `ping` | Count a heartbeat. Add no text and claim no progress. |
| 5 | Second `text_delta` | Append it to the cumulative snapshot. |
| 6 | Text block stops | Block 0 is complete. The Message can still add blocks. |
| 7 | `tool_use` starts at index 1 | Save its ID and tool name. Input starts empty. |
| 8 | First `input_json_delta` | Append the partial JSON string. Do not parse. |
| 9 | Second `input_json_delta` | Append again. Still do not parse. |
| 10 | Tool block stops | Parse the full string once and validate the schema. |
| 11 | `message_delta` has `tool_use` | The application must handle the client tool call. |
| 12 | `message_stop` | The first model stream is complete. The tool has not run yet. |
| 13 | Account authorization passes | The requested account is in the employee allowlist. |
| 14 | Client tool starts | The prepared application trace moves to `running`. |
| 15 | Mock backend receipt arrives | The teaching trace records a simulated result. No real execution occurred. |
| 16 | Next request is built | The `tool_result` uses the original tool call ID. |
| 17 | A new Message starts | Claude receives the conversation history and tool result. |
| 18 | A new text block starts | The second Message begins at index 0. |
| 19 | Final text arrives | It is still a draft that needs source review. |
| 20 | Final text block stops | The content block is complete. |
| 21 | `message_delta` has `end_turn` | The model completed its response naturally. |
| 22 | `message_stop` | The second stream is complete. |
| 23 | Human source review passes | The renewal brief can move to `complete`. |

The exact rejoin sentence is:

> At step 10, the full tool input is parsed and schema-valid. Application account authorization has not happened yet.

## Tool JSON assembly

`input_json_delta.partial_json` is a fragment. Even when the current buffer looks complete, wait for `content_block_stop` before the normal full parse and schema check.

```text
fragment 1: {"account_id":"acct_northstar",
fragment 2: "fields":["account_owner","renewal_date","discount_percent_discussed","discount_approval","sso_entitlement","support_case","weekly_active_users","usage_cause"]}
```

At block stop, the application joins the fragments and parses:

```json
{
  "account_id": "acct_northstar",
  "fields": [
    "account_owner",
    "renewal_date",
    "discount_percent_discussed",
    "discount_approval",
    "sso_entitlement",
    "support_case",
    "weekly_active_users",
    "usage_cause"
  ]
}
```

The schema requires an `account_id` string and a string array named `fields`. It does not enforce non-empty values. Check those conditions before dispatch. Schema success does not grant account access.

## Application authorization and execution

The prepared application state compares `acct_northstar` with the fixture employee allowlist. Only a matching, schema-valid request can move from `proposed` to client tool execution. This replay does not implement employee sign-in. The standalone MCP lab uses the equivalent fictional identifiers `northstar-freight` and `demo-account-owner`.

The lab uses these application states:

| State | Meaning |
| --- | --- |
| `proposed` | A request or validated tool call exists. Execution has not started. |
| `assembling` | The application is collecting content or tool JSON fragments. |
| `running` | The application has evidence that generation or a client tool is active. |
| `awaiting-confirmation` | Generation or a mocked tool result completed, but another confirmation is required. |
| `complete` | The final response completed and required facts passed human source review. |
| `partial-error` | Readable output may exist, but the requested task is incomplete. |
| `outcome-unknown` | A tool started and the application did not receive a final backend receipt. |

The happy path includes `mock_receipt_001`. It is a prepared teaching receipt. It is not a real CRM action.

The unauthorized path requests `acct_aurora`, which is absent from the allowlist. The application returns an error result without starting the tool:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_aurora_002",
  "content": "AuthorizationError: account is not available to this employee",
  "is_error": true
}
```

## Conversation history and matching tool IDs

After a client tool result, the next request preserves the earlier conversation, the assistant Message containing `tool_use`, and a new user Message containing `tool_result`. The array below is a replay-only excerpt showing the tool call and matching result. It omits the earlier user Message and assistant text for readability and is not a complete continuation request.

For a real continuation, append the complete received assistant `content` unchanged, including text, thinking, or redacted-thinking blocks when present. Preserve the earlier history. Do not rebuild the assistant Message from only the `tool_use` block shown here.

```json
[
  {
    "role": "assistant",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_northstar_001",
        "name": "read_account_record",
        "input": {
          "account_id": "acct_northstar",
          "fields": [
            "account_owner",
            "renewal_date",
            "discount_percent_discussed",
            "discount_approval",
            "sso_entitlement",
            "support_case",
            "weekly_active_users",
            "usage_cause"
          ]
        }
      }
    ]
  },
  {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_northstar_001",
        "content": "{\"account_owner\":\"Maya Chen\",\"renewal_date\":\"2027-01-31\",\"discount_percent_discussed\":12,\"discount_approval\":\"not_recorded\",\"sso_entitlement\":\"unknown\",\"support_case\":{\"id\":4821,\"status\":\"open\"},\"weekly_active_users\":{\"current\":64,\"previous\":78},\"usage_cause\":\"not_established\"}"
      }
    ]
  }
]
```

The tool result belongs first in that user content array. The ID match lets Claude and the application connect the result to the correct call.

## Optional model progress notes

Claude Opus 5.5 can return short model progress notes between tool calls when the beta display mode is enabled. This is optional and does not change the main trace or the step 10 rejoin point.

```json
{
  "headers": {
    "anthropic-version": "2026-10-21",
    "anthropic-beta": "thinking-display-updates-2026-08-18",
    "content-type": "application/json"
  },
  "body": {
    "model": "claude-opus-5-5",
    "max_tokens": 16000,
    "stream": true,
    "thinking": {
      "type": "adaptive",
      "display": "updates"
    }
  }
}
```

Under `display: "updates"`, a `thinking` block with text is model progress narration. A block with an empty `thinking` field keeps reasoning hidden. Neither is a tool receipt, execution state, completion signal, raw chain of thought, or runtime percentage.

```json
{
  "type": "thinking",
  "thinking": "The account record preserves the unresolved discount and SSO fields. I will check support and usage next.",
  "signature": "opaque_example_signature_not_live_or_replayable"
}
```

The typed progress block is separate from `text` and `tool_use` blocks. When streamed, its text arrives in an indexed `thinking_delta`. The following standalone illustration uses block index 2. It is not the earlier two-block replay message:

```json
{
  "type": "content_block_delta",
  "index": 2,
  "delta": {
    "type": "thinking_delta",
    "thinking": "The account record preserves the unresolved discount and SSO fields. I will check support and usage next."
  }
}
```

The signature above is a prepared opaque placeholder. It is not live, valid, or replayable. Keep backend state tied to application dispatch records and receipts.

[Official guide: progress updates between tool calls](https://platform.claude.com/docs/en/build-with-claude/thinking#progress-updates-between-tool-calls)

## Terminal conditions

`end_turn` means the model completed the response naturally. It does not mean every required field is present or every claim has a source.

`max_tokens` means the response reached the configured output limit. Preserve useful text, mark it incomplete, and decide whether a new request is appropriate. Do not infer runtime progress from output token counts.

An SSE error can arrive after the initial HTTP response. For example:

```json
{
  "type": "error",
  "error": {
    "type": "overloaded_error",
    "message": "Overloaded"
  }
}
```

Preserve partial text and show `partial-error`. Do not fabricate `message_stop`.

When a client tool started but no backend receipt arrived, show `outcome-unknown`. Reconcile the backend before retrying a tool that can have side effects.

## Fresh changed assumption

Start from the completed happy path. Change the final model sentence to:

> Northstar renews on January 31, 2027, with a 12 percent approved discount.

Keep the final stop reason as `end_turn` and the final stream event as `message_stop`.

Now check the four synthetic source records. CRM confirms January 31, 2027 and Maya Chen. CALL says 12 percent was discussed with no recorded approval and leaves SSO unknown. SUPPORT says case 4821 is open. USAGE says weekly active users changed from 78 to 64 and establishes no cause. The correct result is:

- Generation complete: yes
- Stream complete: yes
- Discount source check: failed
- Business complete: no
- Application state: `partial-error`
- Next owner: the account owner who can locate the approval record

The learning check is: why does `end_turn` fail to support the 12 percent discount claim?

Completed answer: `end_turn` describes how the model stopped. It does not verify a business fact. The discount needs an approval source before anyone uses it.

## Role views

All three roles inspect the same prepared events.

### Engineer

Name the event or application check that makes the next transition safe. Bring back a block index, stop reason, tool ID, schema result, or authorization result.

### Sales

Name the customer claim that can be used now and the claim that still needs a source. Bring back the exact CRM field or approval record.

### Product

Name the state the interface should show now and the evidence that permits the next state. Explain why step position is not runtime progress.

## Five-part facilitation sequence

1. Familiar task: compare the trace with package tracking and delivery confirmation.
2. Plain explanation: name what each event proves and what it cannot prove.
3. Demonstration: run the happy tool cycle through the source review.
4. Business value: show how honest states prevent unsafe retries and unsupported customer claims.
5. Learning check: switch role view or run the changed discount assumption.

Give a blocked learner the completed reference and jump to step 10. Ask them to explain the validated input before continuing. A faster learner can classify `max_tokens`, an SSE error after HTTP acceptance, and a tool timeout without a backend receipt.

## Official Anthropic references

- [Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)
- [Stop reasons and fallback](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
