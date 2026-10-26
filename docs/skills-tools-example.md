# A renewal procedure, an MCP tool, and native Skill execution

Use one fictional Northstar Freight task to see what each layer does. The goal is a source-bound renewal brief, with unresolved approvals left unresolved.

## The components

| Component | Its job | Where to inspect it |
| --- | --- | --- |
| Skill | Describe the renewal procedure, source checks, and review boundary. | [renewal-brief/SKILL.md](../labs/skills/renewal-brief/SKILL.md) |
| MCP server | Expose a read-only lookup for the synthetic account. | [MCP lab](../labs/mcp/renewal-review/README.md) |
| Application policy | Decide which synthetic actor may read the fixture before any records are selected. | The MCP server and its denial checks |
| Native Skill runner | Upload an allowlisted bundle, pin its real version, and request that version through the Skills API. | [Skill lab](../labs/skills/renewal-brief/README.md) |
| Validation script | Check the returned artifact against the lab's source requirements. | The script packaged with the Skill |

These are complementary layers. A tool can run a script, and a Skill can instruct Claude to use a tool. MCP supplies a common interface for capabilities. The application or service enforces access. None of those labels grants a real employee permission to read customer records.

## Start locally

Follow the [MCP lab](../labs/mcp/renewal-review/README.md) first. Its local smoke needs no model credentials. It starts a real stdio server, discovers the lookup, exercises the permitted path and denials, and can export the permitted synthetic record.

Then follow the [Skill lab](../labs/skills/renewal-brief/README.md). Its offline checks validate the bundle and output contract without provider calls. Upload and model execution require separate explicit opt-in, an approved environment, and the real pin returned by the service.

The combined example is an application-controlled workflow: the application obtains permitted records through MCP before invoking the Skill. It does not claim that Claude independently chose the MCP lookup or used the hosted remote-MCP connector.

## What to check

- The allowed synthetic caller receives only the Northstar record.
- A denied caller is rejected before the fixture is read.
- No tool can update a discount or customer record.
- The native Skill request refers to the real returned ID and exact version, not the placeholders in older prepared examples.
- Execution evidence comes from service tool results and the bundled script, rather than model narration alone.
- The final brief preserves the missing discount approval and SSO entitlement.

All data is synthetic. Local protocol checks, native Skill execution, output validation, and running-app integration have separate evidence. Use the lab receipts to identify what a particular run established.

This is a small protocol exercise. Its deterministic parser supports the supplied fixture format. A script alone can produce this particular brief. Native Skill execution demonstrates packaging and use inside Claude, rather than establishing that a model is necessary for the task. Test a changed source format before extending the parser to another workflow.

## A learning question

Where should an access rule be enforced when a Skill uses records obtained through MCP?

Point to the application or service policy and demonstrate a denial. Then explain what the Skill contributes after the permitted records are available.

## Documentation and source context

The implementation uses the official interfaces cited in [sources and attribution](source-and-attribution.md). That page also separates the documented protocol from the Northstar teaching material.

The discussion that motivated this example appears in Thariq Shihipar's [Agent SDK workshop](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=2199s). The [tools, scripts, and generated-code comparison at 25:43](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=1543s) is useful context. This example adds an inspectable implementation and explicit execution evidence rather than a universal architecture rule.
