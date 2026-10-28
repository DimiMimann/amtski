# Deploying AmtsKI on Easypanel

[`compose.easypanel.yml`](../../compose.easypanel.yml) runs the whole stack as
one Easypanel **Compose** service: app, PostgreSQL with pgvector, Redis, MinIO,
Gotenberg, the PII anonymization service and SearXNG for web search. Easypanel
builds the app image
from this repository. Code execution is disabled because it needs Docker-socket
access on the host.

## Requirements

- Easypanel 2.38 or later, at least 12 GB RAM, about 40 GB free disk
- An OpenAI-compatible chat server and an OpenAI-compatible embedding server
  that return 1024-, 1536- or 2560-dimensional vectors, both reachable from the
  Easypanel host
- HTTPS on the public hostname: the app refuses to start without secure cookies

## 1. Create the service

1. Create a project, then **+ Service → Compose**.
2. **Source → Git**: repository URL of this repository, branch `main`,
   compose file `compose.easypanel.yml`.
3. **Environment**: run `node deploy/easypanel/generate-env.mjs https://<host>`
   locally, paste the output and replace every `<...>` placeholder. Store a copy
   of the values offline. `MCP_ENCRYPTION_KEY` and `MFA_ENCRYPTION_KEY` cannot
   be rotated.
4. **Domains**: add `<host>`, service `amtski-app`, port `3000`.
5. **Deploy**. The first boot runs all database migrations.
   `amtski-app` turns healthy at `GET /api/health`.

A reverse proxy in front of Easypanel must not buffer responses and must allow
long requests. Chat answers stream as server-sent events, and uploads go up to
25 MB. For nginx:

```nginx
proxy_buffering off;
proxy_read_timeout 300s;
client_max_body_size 50m;
```

## 2. Bootstrap

1. Open `https://<host>` and register. This creates the organization and its
   first admin.
2. Make that user a super admin. In Easypanel, open a console on
   `amtski-app`, then:

   ```sh
   node dist/src/cli/main.js users:get -e <email>
   node dist/src/cli/main.js users:make-super-admin -i <user id>
   ```

3. Log out and back in. In **Super Admin Settings → Models Catalog**:
   - Add a language model with provider **MiMann** (the `stackit` slot), the
     server's model id as **name** and any display name. Set the context window
     the server allows.
   - Add an embedding model with provider **OpenAI**, the embedding server's
     model id and its vector dimensions.

   Then permit both models under **Super Admin Settings → Organizations →
   your organization → Models**.
4. Set `DISABLE_REGISTRATION=true` and redeploy.

## Configuration notes

- Web search runs through the bundled SearXNG (`deploy/easypanel/searxng/settings.yml`).
  It hides who searches, but the query text reaches the listed search engines,
  so users must not search with personal data.

- `LLM_BASE_URL` points the *MiMann* (`stackit`) provider at your server. `EMBEDDINGS_BASE_URL`
  becomes `OPENAI_BASE_URL`, so every *OpenAI* model talks to that server and
  never to api.openai.com. Do not add other cloud provider keys if data must
  stay on your servers.
- `WHISPER_BASE_URL` sends voice input to your transcription server
  (`/v1/audio/transcriptions`, model `WHISPER_MODEL`, default
  `openai/whisper-large-v3`). Left empty, voice input falls back to Mistral.
- `TRUST_PROXY=2` assumes one reverse proxy in front of Easypanel's Traefik.
  Add that proxy's address under Easypanel's Trusted Proxies so client IPs
  survive both hops.
- Uploaded tables (CSV, XLSX, XLS, ODS) become data sources that cannot be
  analyzed while code execution is disabled; the model is told so.
- `SOURCE_CODE_URL` must point to the source of the deployed version (AGPL-3.0
  §13). The login page and the user menu link to it.

## Backups

Back up the `postgres-data` and `minio-data` volumes together, as a pair, plus
the environment values. Restoring only one of them makes the nightly orphan
sweep delete files whose database rows are missing.
