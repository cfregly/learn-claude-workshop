# Northstar hook dispatcher lab

This lab is a synthetic application policy exercise for the fictional Northstar account. It makes no Claude API call, CRM call, credential use, or paid request. The Python is not provider wire data and does not execute an actual Claude Code, Agent SDK, webhook, or inference hook. The direct Claude Messages API remains the core model path.

## Task

Run the local dispatcher and explain where authorization happens before data access or a write. Then compare that application boundary with product-specific hook systems. Engineer learners annotate the decision path. Architect learners name ownership, deadlines, recovery, and action evidence. Business learners classify each state as supported waiting, draft ready, or action confirmed.

## Plain-language map

In a direct Messages API integration, a `tool_use` block is a request for your application to consider. Your code validates the authenticated caller, actual account scope, arguments, and side-effect policy before execution. The direct API does not add a general lifecycle hook registry around your application. The [tool call guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls) explains how the application pairs a later result with the actual `tool_use.id`.

[Claude Code hooks](https://code.claude.com/docs/en/hooks) expose events such as `PreToolUse` and `PostToolUse`. A pre hook can decide before the matched tool call. A post hook observes an action that has already happened. Current docs say a command hook failure or timeout does not always block a `PreToolUse` call. Set supported `onFailure: "block"` behavior when that product and hook type must fail closed. Do not state this as a rule for every hook product.

[Agent SDK hooks](https://platform.claude.com/docs/en/agent-sdk/hooks) are callbacks registered through `options.hooks` with matchers. Current docs say an Agent SDK `PreToolUse` callback timeout blocks that tool call. Async output lets the agent continue and therefore cannot block, modify, or undo the operation after it has moved on.

[HTTP middleware](https://platform.claude.com/docs/en/cli-sdks-libraries/middleware) wraps outbound SDK requests and inbound responses. It is useful for request logging, retry policy, annotation, and response handling. It is not the same event surface as agent lifecycle hooks.

[Managed Agents webhooks](https://platform.claude.com/docs/en/managed-agents/webhooks) are asynchronous service notifications. Verify signatures, deduplicate on event ID, fetch current resource state, and do not rely on delivery order. Treat them as notifications rather than authorization for a tool call that already happened.

[Enterprise inference hooks](https://platform.claude.com/docs/en/manage-claude/inference-hooks) are a separate governed product. They send governed prompts, and optionally tool calls, to an organization security service for allow or deny decisions. They are not a substitute name for an application dispatcher.

## Demo

Open the [inline Python reader](https://learn.fluxcapacitor.dev/#material/hook-dispatcher), or run this from the material directory:

```text
python3 hook_dispatcher.py
```

The mock selects an explicit local policy. A before check that exceeds 0.01 seconds is denied. That is this sample runtime's policy, not a promise about Claude Code or Agent SDK behavior. The dispatcher checks authentication, Northstar account scope, and write scope before the store is read. Model-supplied fields that claim approval or a production environment never override caller scope.

A receipt appears only after the synthetic store commits. The allowed case deliberately fails its after-action logger. The committed write and receipt remain. Later logging cannot undo an action that already committed.

## Value

Use three status cards with business learners:

- **Supported waiting:** the before check is pending. No write receipt exists.
- **Draft ready:** a complete draft is available for source review. No account action is implied.
- **Action confirmed:** the synthetic system of record returned a commit receipt. An explanation or audit log can still be missing.

A denied or timed-out before check is marked blocked under this mock's policy. A named owner resolves it before a new attempt.

These labels keep a plausible model statement separate from an authorized action and its evidence.

## Check

Ask the learner to answer four questions from the output:

1. Which fields come from authenticated application state rather than model text?
2. Which denied cases prove that no store read or write occurred?
3. Why does the failed after-action logger leave one confirmed write?
4. Which timeout statement is selected mock policy, and which statements are documented product behavior?

Pass when the learner cites the caller, account set, scope set, read and write counts, receipt, and the correct product-specific timeout rule.

## Reference output

```text
PASS allow status=allowed receipt=synthetic-receipt-001 audit=failed_after_commit
PASS deny status=denied reason=account_out_of_scope receipt=None
PASS forged status=denied reason=missing_write_scope receipt=None
PASS timeout status=denied reason=app_before_check_timeout receipt=None
PASS totals allowed=1 denied=3 reads=1 writes=1
```

The allow case commits once because actual caller scope passes. The account denial, forged approval, and timeout return no receipt and never add a data read or write. The final counts prove the selected mock policy. They do not claim an SDK guarantee or real Northstar activity.

## Changed cases and rejoin

Changed resource case: replace the account write with a read-only lookup of support Case 4821. Require a separate support read scope and keep write count at zero.

Changed failure case: preserve a confirmed write receipt while the after-action log fails. The learner must report action confirmed with an audit warning. They must not retry the write to repair the log.

Rejoin the workshop at [Diagnose the evidence boundary](https://learn.fluxcapacitor.dev/#diagnose) after the learner can distinguish application authorization, pre-execution blocking, after-action observation, asynchronous notification, and governed inference review.
