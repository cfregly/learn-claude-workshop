# One incomplete response, two learner views

This Northstar exercise uses saved synthetic data. It makes no live model call and needs no API key.

The learning objective is to separate three questions:

1. Did the API request return?
2. Why did generation stop?
3. Does the business artifact contain every required field and source?

An engineer answers with a request and event trace. A sales manager answers with an annotated renewal brief. Both views describe the same response.

## Shared case

The application checked the caller and Northstar account access before reading the approved CRM, CALL, SUPPORT, and USAGE files. It then sent this illustrative request:

```json
{
  "model": "ACCOUNT_ENABLED_MODEL",
  "max_tokens": 90,
  "system": "Use only supplied facts. Include sources, unknowns, actions, and owners.",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "[CRM] renewal 2027-01-31, owner Maya Chen. [CALL] 12 percent discussed, no approval. [SUPPORT] case 4821 open. [USAGE] 64 weekly active users, previously 78, cause unknown."
        }
      ]
    }
  ]
}
```

The saved response is typed and readable, but it is not complete:

```json
{
  "id": "msg_northstar_partial",
  "type": "message",
  "content": [
    {
      "type": "text",
      "text": "CONFIRMED FACTS\nNorthstar renews January 31, 2027 [CRM]. Maya Chen owns the account [CRM]. Case 4821 is"
    }
  ],
  "stop_reason": "max_tokens",
  "usage": {
    "input_tokens": 118,
    "output_tokens": 90
  }
}
```

`max_tokens` means generation reached the output limit in the request. Preserve the partial text and request ID for diagnosis. Do not label the renewal brief complete. Shorten the requested output or adjust the bounded output budget, then run a fresh case.

## Engineer route

Annotate the trace:

1. `check_account_access` happened before approved records entered the request.
2. `model` comes from approved configuration.
3. `max_tokens` sets the output limit for this request.
4. `content` contains a typed text block. Filter by block type before reading text.
5. `stop_reason` is `max_tokens`, so the visible string may be truncated.
6. The handler may preserve the partial output for diagnosis, but it must not trigger an external action.

For a streaming request, the same state arrives through events:

```text
message_start(stop_reason=null)
content_block_start(type=text)
content_block_delta(text="CONFIRMED FACTS\n")
content_block_delta(text="Northstar renews January 31, 2027 [CRM]. Case 4821 is")
content_block_stop
message_delta(stop_reason=max_tokens)
message_stop
```

The final `message_delta` carries the stop reason and `message_stop` ends the event flow. A normal stream ending does not make a truncated business artifact complete. A stream can also emit an error after the API has returned HTTP 200. Preserve received text for diagnosis, record the error, and keep the artifact incomplete when that happens.

### Engineer task

Write four annotations:

- The field that bounded output.
- The event that carried the stop reason.
- The event that ended the normal event flow.
- The code decision that prevents partial text from entering the account process.

Then choose one fresh test. Either request a shorter brief within the same bounded budget or raise the bounded budget and run the same synthetic case again.

## Sales manager route

The business view shows this partial brief:

```text
CONFIRMED FACTS
Northstar renews January 31, 2027 [CRM].
Maya Chen owns the account [CRM].
Case 4821 is
```

Annotate it against the required artifact:

| Review item | Finding |
| --- | --- |
| Renewal date and owner | Present and source-labeled |
| Support status | Cut off and unusable |
| Discount and SSO unknowns | Missing |
| Proposed next actions | Missing |
| Technical and account owners | Missing |
| Final source check | Missing |
| Decision | Withhold from account planning |

The technical owner shortens the requested output or adjusts the bounded budget and runs a fresh case. The account owner checks the fresh brief against CRM, CALL, SUPPORT, and USAGE. Generation must finish, every required section must be present, and the source check must pass before the brief can support account planning.

### Sales manager task

Mark each line as supported, incomplete, or unsupported. List every missing required section. Then write one next step for the technical owner and one for Maya Chen, the fictional account owner.

## Completed reference

```text
STATUS: Incomplete because stop_reason is max_tokens.

PRESERVE FOR DIAGNOSIS: The renewal date and Maya Chen ownership statements
match CRM. Keep the partial response and request ID out of the account workflow.

INCOMPLETE: "Case 4821 is" does not state a usable case status.

MISSING: Discount and SSO unknowns, proposed next actions, owners, and the
source check.

TECHNICAL NEXT STEP: Request a shorter structured brief or raise the bounded
output budget. Run a fresh synthetic case and record its terminal state.

ACCOUNT NEXT STEP: Maya checks the fresh brief against CRM, CALL, SUPPORT, and
USAGE before anyone uses it for account planning.

USE CONDITION: Generation reaches a terminal state, all required sections are
present, and every customer claim passes the source check.
```

## Changed case

A fresh response includes all required sections and ends with `stop_reason: end_turn`. It also says, “The 12 percent discount is approved.”

`end_turn` means Claude completed the response naturally. It does not prove that the business artifact is factual or approved. The call notes record that 12 percent was discussed and no approval was recorded. Reject or revise the claim, keep discount approval unknown, and ask the account owner for the approval record.

## Shared rejoin

The engineer explains the terminal trace and the fresh technical test. The sales manager explains one missing action, its evidence, and its owner. Rejoin on this statement:

> Generation status and business completeness are separate checks.

Continue when both learners can explain why a readable partial response is withheld and why an `end_turn` response still needs required fields and a source check.

## Official Anthropic references

- [Stop reasons and fallback](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
- [Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Claude API errors](https://platform.claude.com/docs/en/api/errors)
