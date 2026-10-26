# Sources and attribution

This is an independent teaching project about Claude. It applies documented capabilities to a fictional Northstar Freight renewal task. It does not present API field names, SDK methods, MCP, or the Skill format as inventions of this workshop.

## What comes from the documented interfaces

| Material | Source | How this workshop uses it |
| --- | --- | --- |
| Messages requests and typed responses | [Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages) | Request fields and content types follow the public contract. The application adds the synthetic account policy and review states. |
| Streaming events and partial tool JSON | [Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming) | The protocol explanations in the streaming lesson adapt this documentation. The Northstar traces and failure exercises apply the protocol to a teaching case. |
| Tool continuation | [Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls) | The assistant tool request and matching user tool result follow the documented exchange. The lookup, fixture validation, and call limits are application code. |
| Skill packaging and native API use | [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) and [Skills in the API](https://platform.claude.com/docs/en/build-with-claude/skills-guide) | The file format and execution mechanism follow the product. The renewal procedure, source checks, and changed cases belong to this workshop. |
| MCP transport and tool registration | [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28) and [Python SDK](https://github.com/modelcontextprotocol/python-sdk) | The SDK handles the protocol. The synthetic account lookup and trusted fixture actor are defined by the lab. |
| Isolation and credentials | [Agent security guidance](https://code.claude.com/docs/en/agent-sdk/secure-deployment) | The examples apply the documented principles to small, synthetic tasks. They are not a production security certification. |

The guides also link the official sources for citations, structured outputs, caching, thinking, hooks, and related features. Those are explanations and applications of existing features, not new protocols.

## What is specific to this workshop

- The Northstar records, people, dates, support cases, and unknown approvals are fictional teaching data.
- The role paths change the task, explanation, practice, and learning check for the audience.
- The application checks access before selecting account facts, distinguishes partial output from a reviewable draft, and keeps business approval separate from generation.
- The replay packets, changed cases, failure recovery exercises, and tests make those boundaries inspectable.
- The Skill and MCP labs provide small implementations of the renewal procedure and local read-only tool.

The contribution is the worked case, teaching design, and inspectable application behavior. A passing local test proves the behavior it checked. It does not prove production identity propagation, customer-system access, or a business result.

## Execution claims

Keep these states separate:

1. A `SKILL.md` file exists.
2. A real Skill bundle was uploaded and its returned version was pinned.
3. A request selected that pinned version.
4. Tool evidence shows the bundled procedure or script was accessed and executed.
5. The resulting draft passed the stated source checks.

A file in the repository or a model saying it used a Skill does not establish all five. The lab runners retain evidence for the stages they observe.

Likewise, MCP tool definitions are not evidence of a server connection. The MCP smoke checks initialize a real local server, discover its tools, invoke the allowed lookup, test denials, and close the session. The account identity remains a synthetic server-side fixture rather than an authenticated employee.

## Scope of the source review

A bounded review on October 26, 2026 compared representative implementation patterns and passages with the linked official material. It found standard API usage and an explicitly credited adaptation of streaming explanations. It did not establish repository-wide originality or authorship. This page records source relationships so readers do not need to infer them.
