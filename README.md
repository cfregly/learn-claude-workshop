# Learn Claude workshop

This repository contains the public code, notebooks, fixtures, and teaching references for the Learn Claude workshop. Northstar Freight, its records, people, identifiers, traces, and decisions are fictional.

The live workshop is [learn.fluxcapacitor.dev](https://learn.fluxcapacitor.dev). It supports self-paced learning and facilitator-led sessions across twelve audience paths.

## What runs live

The live site's networked behavior is limited to bounded, text-only Claude Messages API requests for the fixed synthetic demo and the contextual Ask panel. It does not read customer systems, execute the prepared client tool, change records, send messages, or approve an action.

The streaming and tool-use trace, thinking lesson, model-capability snapshot, and optional feature guide are prepared course materials. The examples teach citations, structured outputs, prompt caching, app-owned memory, Skills, read-only programmatic tool calling, the advanced advisor pattern, and input token counting. They do not show that those features ran on the live site.

## Start here

1. Read the [Northstar source pack](docs/northstar-source-pack.md).
2. Open the [API trace notebook](labs/api-trace.ipynb) and run its cells from top to bottom.
3. Run the direct API client in offline mode:

   ```bash
   python3 labs/claude_api_demo.py
   ```

4. Open the [renewal-window starter lab](labs/northstar-renewals/starter/README.md), add the missing boundary test, and compare your work with the [reference fix](labs/northstar-renewals/REFERENCE_FIX.md).

## Teaching references

- [Claude for Work activity](docs/claude-for-work.md)
- [Facilitator guide](docs/facilitator-guide.md)
- [Incomplete response lesson](docs/incomplete-response.md)
- [Security and regulated workflow review](docs/security-workshop.md)
- [Streaming and tool-use trace](docs/streaming-lab.md)
- [Thinking lesson](docs/thinking-lab.md)
- [Reviewed model-capability snapshot](docs/model-capabilities.json)
- [Optional supporting features](docs/supporting-features.md)

## Practice code

- [Offline API trace notebook](labs/api-trace.ipynb)
- [Direct Claude API client with offline default](labs/claude_api_demo.py)
- [Synthetic evaluation fixtures](labs/source-fixtures.json)
- [Standalone live API lab](labs/live-api/README.md)
- [Claude Code boundary lab](labs/northstar-renewals/README.md)
- [Versioned renewal-brief Skill](labs/skills/renewal-brief/SKILL.md)

The standalone live API lab contains the server and bounded request handler used by the site. It also includes focused tests that inject provider responses and make no paid model calls. The website interface is not part of this repository.

## Direct runtime boundary

The live app's editable source is `/opt/learn-claude-workshop/app` on `piq-runtime`. The isolated `learn-claude-workshop.service` watches that path. Its service identity, credential file, port, and model-usage ledger are separate from other applications on the host.

Publishing this repository does not by itself change the running app. Runtime edits happen directly in `/opt/learn-claude-workshop/app`, followed by the focused checks for that service.

## Offline validation

Run the starter tests:

```bash
cd labs/northstar-renewals/starter
python3 -m unittest discover -s tests -q
```

Run the reference solution tests:

```bash
cd labs/northstar-renewals/solution
python3 -m unittest discover -s tests -q
```

Run the standalone API lab tests:

```bash
cd labs/live-api
npm test
```

The notebook and default Python client use synthetic data and run offline. Keep credentials, customer data, and private notes out of this repository.
