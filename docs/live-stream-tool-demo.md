# Live provider streaming with one read-only tool

Use this optional lab after the replay. It streams two real Claude Messages API responses through the official Python SDK. Between them, the local application executes one read-only lookup against the bundled synthetic Northstar fixture.

No CRM connection exists. No customer record changes. The tool accepts only `northstar-freight`, and the application rejects every other name or input shape before reading the fixture.

## Choose the right route

- **Replay for repeatable teaching and failures.** Use [Streaming events](https://learn.fluxcapacitor.dev/#streaming) to inspect fixed happy, unauthorized, and interrupted traces. It needs no API key and makes no provider call.
- **Live for provider streaming and an executed local lookup.** Use the [in-app real workflow](https://learn.fluxcapacitor.dev/#streaming/engineer/live) alongside the [Python starter](https://learn.fluxcapacitor.dev/#material/live-stream-tool-code) when you want to observe actual event timing, tool requests, stop reasons, and API errors.

The live route can cost money. Its output varies by model and request. The replay remains the small, stable teaching baseline.

## What the live starter does

1. Starts one provider stream without forced `tool_choice` or an automatic retry.
2. Preserves every assistant content block from the first response.
3. Requires exactly one `lookup_northstar_account` request with `account_id` set to `northstar-freight`.
4. Checks the in-code synthetic caller allowlist before reading `source-fixtures.json#baseline`.
5. Sends one matching `tool_result` with the original `tool_use.id`.
6. Streams the final draft and requires `end_turn` plus `message_stop`.
7. Stops after two provider attempts and one local lookup.

Each provider call gets one attempt. The SDK retry count is zero and each attempt has a 60 second timeout. A failed first stream is not retried and does not reach the lookup. A failed final stream is not retried and never causes a third provider call.

The second request keeps all first-response blocks, including any model text before the tool request. If the chosen model and settings return a signed thinking block, the application round-trips that block without printing its contents. It never treats model narration as proof that the tool ran.

## Set up the optional SDK

From the public repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-live.txt
```

The pinned requirement is the official Anthropic Python SDK. The starter uses `client.messages.stream(...)`, iterates raw stream events, and reads the completed Message with `get_final_message()`.

Run the offline default first. Start this independent block from the public repository root, with the virtual environment above active:

```bash
python labs/live-stream-tool-demo.py
```

Expected boundaries include:

```text
mode=offline
network_calls=0
tool_calls=0
```

The default command does not import the SDK, read a credential, execute the lookup, or make a network request.

## Run live with your environment

Start this independent block in a terminal at the public repository root, with the virtual environment above active. Enter the exact model ID enabled for your account at the first prompt. The block rejects empty input or whitespace before asking for a key. This local format check does not verify model access or tool support, so confirm both in your account first. Bash then prompts for the key without echoing it. The key is passed to the child Python process through its environment, not through a command argument or a shell history line. Do not paste it into the script or workshop site.

```bash
bash <<'BASH'
set -e
read -r -p "Model ID enabled for your account: " ANTHROPIC_MODEL </dev/tty
if [[ -z "$ANTHROPIC_MODEL" || "$ANTHROPIC_MODEL" == *[[:space:]]* ]]; then
  printf 'Enter a nonempty model ID without whitespace. No request was sent.\n' >&2
  exit 1
fi
export ANTHROPIC_MODEL
read -r -s -p "Anthropic API key: " ANTHROPIC_API_KEY </dev/tty
printf '\n'
export ANTHROPIC_API_KEY
python labs/live-stream-tool-demo.py --live
BASH
```

The key is available to this spawned Bash process and its child processes until they exit. This block does not save it to a file or change your parent shell's environment. Keep the terminal free of shell tracing while entering and using the key.

### Maintainer alternate: app checkout

The public repository also contains the same starter at `app/public/materials/live-stream-tool-demo.py`. From the public repository root, this block runs that copy offline and leaves the parent shell in the repository root:

```bash
(
  set -e
  cd app
  python public/materials/live-stream-tool-demo.py
)
```

A maintainer already working inside `app/` uses `python public/materials/live-stream-tool-demo.py` instead. For an explicitly approved live run in that directory, use the silent-prompt block above with `python public/materials/live-stream-tool-demo.py --live` as its Python command. The default learner commands remain under `labs` from the repository root.

The script passes `ANTHROPIC_API_KEY` to the SDK as `auth_token`. It does not also set the SDK `api_key` field. The resulting request uses `Authorization: Bearer` and pins `anthropic-version` to `2026-10-21`. Automatic retries are disabled.

When `ANTHROPIC_MODEL` is exactly `claude-sonnet-5-5`, both request envelopes set `thinking` to `{"type":"between_tools"}`. Other model values do not receive a hardcoded thinking setting. No request uses forced `tool_choice`. Check current model and account documentation before choosing `ANTHROPIC_MODEL`.

An API credential authorizes the provider request. It does not prove that the caller may read a company account. The bundled caller is a synthetic teaching fixture, not an employee identity or production access check. Approval to use any real customer source is outside this lab and remains unknown.

## Read the live output

`provider_stream=1` means the first response is arriving. Text may appear before the tool request. That text is model output only.

`lookup_status=completed_read_only_synthetic` means local application code validated the tool name and argument, checked the fixture allowlist, and read the synthetic baseline record.

`provider_stream=2` means the matching tool result is in the next request and the final draft is arriving.

A successful run ends with:

```text
provider_calls=2
read_only_lookups=1
generation_status=completed_end_turn
draft_status=ready_for_human_source_review
business_status=not_accepted
```

The draft still needs human source review. A complete model stream does not approve a discount, establish SSO entitlement, accept a business action, or prove production account access.

## Interrupted and rejected runs

If a provider error arrives after some text, the starter keeps that text visible and prints `status=incomplete`. It does not fabricate `message_stop`, continue with partial tool JSON, retry the failed request, or send another request.

If the first response omits the tool, asks for a different tool, supplies another account, or requests more than one tool call, the application stops before the local lookup.

If the final response reaches `max_tokens`, requests a second tool, or ends without `message_stop`, the application leaves the draft incomplete. It never makes a third provider call.

## Learning check

Point to the evidence for each statement:

- The provider stream ended.
- The local read-only lookup ran.
- The result matches the original tool request.
- The final generation ended naturally.
- The renewal brief is ready for human source review.
- No production customer action occurred.
