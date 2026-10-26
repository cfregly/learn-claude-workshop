# Diagnostic exercise instructor guide

## Scope and evidence rule

All eight cases are synthetic teaching fixtures. Every time, identifier, event, result, and failure was invented for practice. None is an API measurement, provider request, browser capture, or paid call. The packet labels describe parsed events and application observations. They are not an exact network trace or actual provider wire format.

Teach one custody boundary at a time. A network read is only a byte chunk. Keep decoder state across reads with `TextDecoder.decode` streaming mode, buffer until a full server sent event frame is available, then parse its event name and JSON. One read may split a frame or contain several frames. First byte, first event frame, typed event, text delta, backend relay, browser receipt, client state, visible text, stop event, and connection EOF are separate facts.

## Ten minute teaching loop

Use the same loop for every packet: evidence, plausible causes, one discriminating check, supported repair, verification through the visible path, then one changed case. Spend one minute on the last confirmed boundary, two on causes, two on the check, two on repair, two on verification, and one on transfer.

When a learner starts a fresh independent attempt, preserve the prior answers in the learning record and clear only the active workspace. Keep the packet evidence visible. Reveal guidance and the completed reference only after the learner commits one next check. The [curated replay source](../labs/diagnostics/diagnostics-lab.js) implements this boundary.

Keep identities separate. Correlate the application trace, attempt, provider message ID, content block, `tool_use.id`, and business operation key. Never substitute one for another. A ping proves connection activity, not reasoning progress. HTTP 200 can precede a streamed error. EOF without the required terminal event is an interruption. `message_stop` closes the protocol message. It does not prove a correct business result.

Role prompts:

- Engineer: annotate the parsed event and repair the full path to visible output.
- Architect: name ownership, deadlines, recovery, and evidence of any action.
- Sales or RevOps: distinguish supported waiting, draft ready, and action confirmed.

## Instructor key

### 1. Healthy text reconstructs Renewal

**Expected boundary:** The UI shows `Renewal`, and `message_stop` closes the synthetic stream. **Discriminating check:** Compare backend deltas, browser deltas, and rendered text under `opaque-fixture-A`. **Supported repair:** None when all three match. Stop at the first mismatch if they do not. **Verification:** `Ren` and `ewal` each append once, block 0 closes, `end_turn` and `message_stop` arrive, and the UI shows `Renewal`. **Blocked learner:** Show the three custody lists and ask them to choose comparison over a new request. Rejoin at recovery and verification after the choice. **Changed case:** Reverse the delta order. Diagnose ordering instead of guessing the word.

### 2. Pings without answer progress

**Expected boundary:** The backend connection was active at the last ping. No content or completion is confirmed. **Discriminating check:** Find the last complete non-ping event and any active block within the deadline. **Supported repair:** Show waiting only. At the deadline, close the attempt as incomplete and offer a new text-only attempt. **Verification:** The new attempt needs its own content and terminal evidence. More pings do not count. **Blocked learner:** Offer “inspect the next non-ping event” or “estimate percent complete.” Rejoin at recovery and verification after they choose the event. **Changed case:** Replace the third ping with one text delta. Content has started, but completion is still unknown.

### 3. Backend text with no browser event

**Expected boundary:** The backend parsed `Renewal`. Delivery after its write attempt is unconfirmed. **Discriminating check:** Record write completion and flush, then test proxy buffering. **Supported repair:** Fix relay framing or flush behavior before touching the UI. **Verification:** Under one application trace, the browser receives the same text delta and the UI renders `Renewal` once. **Blocked learner:** Offer relay flush inspection or UI reducer changes. Rejoin at recovery and verification after they choose the relay. **Changed case:** If the browser gets the delta while the UI stays blank, move the boundary to browser or client state.

### 4. Browser deltas filtered before display

**Expected boundary:** The browser received `Ren` and `ewal`. The UI adapter discarded both. **Discriminating check:** Trace one event through the adapter and reducer with event type, delta type, and block index intact. **Supported repair:** Accept text deltas and append text to the matching block state. **Verification:** The fixture produces two reducer actions, one visible `Renewal`, and no text for non-text deltas. **Blocked learner:** Offer adapter mapping or backend retry. Rejoin at recovery and verification after they choose mapping. **Changed case:** If text disappears when block 1 starts, inspect state storage by block index.

### 5. Cumulative snapshots appended as deltas

**Expected boundary:** The browser received cumulative snapshots. The reducer appended them and displayed `RenRenewal`. **Discriminating check:** Read the relay contract and decide whether the field is a delta or replacement snapshot. **Supported repair:** Relay true deltas and append, or relay snapshots and replace. Version the mode. **Verification:** Replaying the fixture ends with exactly `Renewal`. **Blocked learner:** Show values `Ren` then `Renewal` and ask whether the second value adds or replaces. Rejoin at recovery and verification after the choice. **Changed case:** For true deltas with one replayed frame, test replay handling instead.

### 6. Streamed error after HTTP 200

**Expected boundary:** Partial text reached the backend before an overloaded error. No complete message is confirmed. **Discriminating check:** Inspect the parsed event type and error class, not the initial status. **Supported repair:** Preserve the text as incomplete and offer one bounded retry only for the transient error. **Verification:** The retry must close its own blocks and reach `message_stop`. **Blocked learner:** Point to HTTP 200 and the later error, then ask which fact classifies the final attempt. Rejoin at recovery and verification after they choose the error. **Changed case:** Make the error non-retryable. Surface it without automatic retry.

### 7. Partial tool JSON at the output limit

**Expected boundary:** Partial JSON is buffered for block 2 and mapped to `opaque-tool-ref-A`. Dispatch count is zero. Partial JSON is neither valid input nor authorization. **Discriminating check:** Require block closure, parse the full buffer, validate schema and permission, then inspect the stop reason. **Supported repair:** Start a fresh attempt with enough output budget. There is no side effect to reconcile. **Verification:** Dispatch only complete, valid, authorized input. Pair `tool_result.tool_use_id` with that attempt's actual `tool_use.id`, never block index 2. **Blocked learner:** Ask them to choose the tool ID or the block index for pairing. Rejoin at recovery and verification after they choose the ID. **Changed case:** Complete JSON with denied account permission still means no dispatch.

### 8. Confirmed write with lost final explanation

**Expected boundary:** The system of record confirms one write at revision 17. The final explanation is missing. **Discriminating check:** Re-read the record by `opaque-operation-key-B` and inspect the stored receipt before any retry. **Supported repair:** Reuse the receipt and request a new explanation with writing disabled, or enforce deduplication by the business operation key. **Verification:** The record still has one write, the original tool request and result stay paired, and the new explanation reaches `end_turn` and `message_stop` without another write. **Blocked learner:** Offer immediate write retry or receipt reconciliation. Rejoin at recovery and verification after they choose reconciliation. **Changed case:** With no matching receipt, mark the action unknown and reconcile before deciding on retry.

## Scoring rubric

Score each dimension from 0 to 2 for a total of 10. Give 0 when it is absent or contradicts evidence. Give 1 when it is plausible but skips a boundary or lacks a concrete test. Give 2 when it is evidence-bound and specific.

- **Diagnosis:** Names the last confirmed boundary and separates observation from inference.
- **Next check:** Chooses one check that can distinguish the leading causes.
- **Repair:** Fits the evidence, preserves incomplete states, and avoids unsafe side effects.
- **Verification:** Follows the repaired attempt through protocol, browser, UI, and action evidence as applicable.
- **Changed case transfer:** Changes the diagnosis or recovery when the changed evidence requires it.

Record only what the learner demonstrates in this exercise. Do not claim past learner outcomes. A blocked learner sees the named boundary and two checks, chooses one, then rejoins at recovery and verification.

## Primary references

- [Workshop diagnostic path](https://learn.fluxcapacitor.dev/#diagnose)
- [Claude streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Claude API errors](https://platform.claude.com/docs/en/api/errors)
- [MDN server sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN ReadableStreamDefaultReader.read](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/read)
- [MDN TextDecoder.decode](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode)
