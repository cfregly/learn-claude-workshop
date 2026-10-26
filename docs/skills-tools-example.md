# A renewal procedure, an MCP tool, and a native Skill lab

Use one fictional Northstar Freight task to see what each layer does. The goal is a source-bound renewal brief, with unresolved approvals left unresolved.

Status on October 26, 2026: the local MCP smoke and offline tests have run. The native Skill bundle has not been uploaded or invoked through the Messages API. The request path is configured. The response checker is tested against authored response fixtures. Integration into the running workshop is separate work.

## The components

| Component | Its job | Where to inspect it |
| --- | --- | --- |
| Skill | Describe the renewal procedure, source checks, and review boundary. | [renewal-brief/SKILL.md](../labs/skills/renewal-brief/SKILL.md) |
| MCP server | Expose a read-only lookup for the synthetic account. | [MCP lab](../labs/mcp/renewal-review/README.md) |
| Application policy | Decide which synthetic actor may read the fixture before any records are selected. | The MCP server and its denial checks |
| Native Skill runner | Upload an allowlisted bundle through the Skills API, pin its returned version, and select it in a Messages request through `container.skills`. | [Skill lab](../labs/skills/renewal-brief/README.md) |
| Bundled renderer | Build and self-check the fixture-format brief inside the Skill container. | The script packaged with the Skill |
| Local evidence checker | Compare returned tool results, mounted-file hashes, and output with the local pin and expected result. | [evidence.py](../labs/skills/renewal-brief/renewal_skill/evidence.py) |

These are complementary layers. A tool can run a script, and a Skill can instruct Claude to use a tool. MCP supplies a common interface for capabilities. The application or service enforces access. None of those labels grants a real employee permission to read customer records.

## Start locally

Follow the [MCP lab](../labs/mcp/renewal-review/README.md) first. Its local smoke needs no model credentials. It starts a real stdio server, discovers the lookup, exercises the permitted path and denials, and can export the permitted synthetic record.

Then follow the [Skill lab](../labs/skills/renewal-brief/README.md). Its offline checks validate the bundle and output contract without provider calls. Upload and model execution require separate explicit opt-in, an approved environment, and the real pin returned by the service.

The operator exports the MCP smoke result to a file and passes that file to the Skill runner. The runner treats it as caller-supplied data. It cannot tell whether it came from MCP. The model does not select or call MCP in this flow.

## What to check

- The allowed synthetic caller receives only the Northstar record.
- A denied caller is rejected before the fixture is read.
- No tool can update a discount or customer record.
- After an upload, the native Skill request must select the real returned ID and exact version.
- Execution evidence comes from service tool results and the bundled script, rather than model narration alone.
- The final brief preserves the missing discount approval and SSO entitlement.

The bundled records are synthetic. Local protocol checks, native Skill execution, output validation, and running-app integration each produce evidence when run. As of this revision, only local MCP behavior and offline checks have been observed. Use the lab receipts to identify what a particular run established.

This is a small protocol exercise. A script alone produces this particular brief. Its parser supports the supplied fixture formats and fails closed on an approval section. The proposed native Skill run demonstrates packaging and use inside Claude, rather than establishing that a model is necessary for this task. Test a changed source format before extending the parser to another workflow.

## Choose by the requirement

Use a script for a fixed computation or check. Expose an operation as a tool when Claude needs to request it. Use a Skill to package procedure, examples, and supporting resources for Claude. Use MCP when compatible hosts need a common capability interface. An existing API can remain behind the tool, and a script can be part of the Skill. These are design choices for the task, rather than mutually exclusive replacements. The [official sources](source-and-attribution.md) define the interfaces.

## A learning question

Where should an access rule be enforced when a Skill uses records obtained through MCP?

Point to the application or service policy and demonstrate a denial. The lab's actor is chosen by a launch flag and checked against a fixture record. Explain how a real service would replace those teaching inputs with trusted identity and access policy. Then explain what the Skill contributes after permitted records are available.

## Documentation and source context

The implementation uses the official interfaces cited in [sources and attribution](source-and-attribution.md). That page also separates the documented protocol from the Northstar teaching material.

The discussion that motivated this example appears in Thariq Shihipar's [Agent SDK workshop](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=2199s). The [tools, scripts, and generated-code comparison at 25:43](https://www.youtube.com/watch?v=TqC1qOfiVcQ&t=1543s) is useful context. This example adds an inspectable implementation and explicit execution evidence rather than a universal architecture rule.
