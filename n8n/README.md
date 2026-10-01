# n8n — LeadFlow Outreach Engine

This is the actual n8n workflow that orchestrates LeadFlow's outbound
outreach automation. It has been imported into a real local n8n instance
(Docker, `n8nio/n8n:latest`, container `amazon-leadflow-n8n`, editor at
`http://localhost:5678`) and executed successfully — see
[`docs/OUTREACH.md`](../docs/OUTREACH.md#n8n-orchestration--set-up-verified-working)
for the verified results.

**LeadFlow owns business state. n8n owns orchestration.** This workflow
contains no CRM logic — it calls one LeadFlow endpoint
(`POST /api/outreach/tick`) and logs what came back.

## Files

- `leadflow-outreach-engine.workflow.json` — the workflow itself. Safe to
  commit: it references a credential by id/name only, never a raw secret.
- `leadflow-credential.template.json` — a template for the HTTP Header Auth
  credential the workflow needs. Replace the placeholder with a real
  LeadFlow API key (Settings → API keys → New key) before importing — never
  commit the filled-in version.

## Import into a running n8n instance

```bash
# 1. Fill in leadflow-credential.template.json with a real API key, save a
#    local copy (e.g. leadflow-credential.local.json) — do not commit it.
docker cp leadflow-credential.local.json <container>:/tmp/cred.json
docker exec <container> n8n import:credentials --input=/tmp/cred.json

# 2. Import the workflow (references the credential above by id).
docker cp leadflow-outreach-engine.workflow.json <container>:/tmp/wf.json
docker exec <container> n8n import:workflow --input=/tmp/wf.json

# 3. Run it once, immediately, to verify:
docker exec <container> n8n execute --id=lfOutreachEngine01
```

If your n8n container is already running and you use `n8n execute`, you may
hit `Task Broker's port 5679 is already in use` — that command starts its
own internal n8n process and can't share the port with an already-running
server in the same container. Either stop the container first and use a
short-lived one-off container against the same data volume:

```bash
docker stop <container>
docker run --rm --network <same-network> -v <same-n8n-data-volume>:/home/node/.n8n \
  --entrypoint n8n n8nio/n8n:latest execute --id=lfOutreachEngine01
docker start <container>
```

...or open the workflow in the n8n editor and use **Execute Workflow**,
which runs it inside the already-running server without this conflict.

## Editing the workflow in the n8n UI instead

If you'd rather build this by hand: add a **Schedule Trigger** (every 15
min for dev), a **Manual Trigger**, and/or a **Webhook** node, all feeding
into one **HTTP Request** node (`POST {your LeadFlow URL}/api/outreach/tick`,
auth = your LeadFlow API key as an `Authorization: Bearer ...` header via an
HTTP Header Auth credential), with its error output wired to a node that
logs the failure without retrying.

From inside a Docker container, reach a LeadFlow instance running on the
Docker host via `http://host.docker.internal:<port>` rather than
`localhost`.
