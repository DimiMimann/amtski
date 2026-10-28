# Modifications

AmtsKI is a modified version of [Ayunis Core](https://github.com/ayunis-core/ayunis-core),
licensed under the GNU Affero General Public License v3.0 (see [LICENSE.md](LICENSE.md)).
It is not an official Ayunis release.

The first commit of this repository is the unmodified upstream tree of Ayunis Core
`v2.57.0`. Every change since then is recorded in the git history; this file
summarizes them as required by section 5(a) of the license.

## 2026-10-27

- **Node.js runtime 24.16.0 → 24.22.1** (`Dockerfile`): picks up the October 2026
  Node.js security release (incl. CVE-2026-111497, Brotli decoder out-of-bounds write).
- **Compressed request bodies are refused** (`ayunis-core-backend/src/main.ts`):
  the JSON and urlencoded body parsers run with `inflate: false`, so
  `Content-Encoding: br|gzip|deflate` requests get HTTP 415 instead of reaching
  the `node:zlib` decoders before authentication.
- **Duplication pre-commit check** (`scripts/check-duplication.sh`): only clones that
  involve staged files fail the hook; Windows path separators are normalized.
- **Provider label** (`ayunis-core-frontend`): the `stackit` provider slot is shown as
  "MiMann", hosted in Eichstetten am Kaiserstuhl, Germany, because this instance
  uses it for a locally hosted model.
- **Repository housekeeping**: removed the upstream GitHub Actions workflows and
  Dependabot config (they target upstream infrastructure), the upstream Infisical
  workspace file, and committed Python build artifacts; shell scripts are checked
  out with LF line endings.

## 2026-10-28

- **Configurable chat endpoint** (`ayunis-core-backend/src/config/models.config.ts`):
  `STACKIT_BASE_URL` overrides the STACKIT cloud URL, so the `stackit` provider
  slot can serve a self-hosted OpenAI-compatible model.
- **Code execution can be disabled** (`CODE_EXECUTION_ENABLED=false`): the
  `code_execution` tool is then not offered to models, and the system prompt says
  attached tables cannot be analyzed instead of pointing to that tool. It stays
  enabled by default.
- **Source code link** (`VITE_SOURCE_CODE_URL`): when set, the login pages and the
  user menu link to the source code of the running version (AGPL-3.0 §13).
- **Container health check** probes `/api/health` instead of `/health`, which the
  SPA fallback always answered, and allows five minutes for the first boot.
- **Easypanel deployment**: `compose.easypanel.yml`, an environment generator and a
  setup guide in `deploy/easypanel/`.
- **SearXNG web search** (`INTERNET_SEARCH_PROVIDER=searxng`, `SEARXNG_URL`): a
  provider for a self-hosted SearXNG instance next to Brave and Staan, bundled in
  the Easypanel stack.
- **Whisper transcription** (`WHISPER_BASE_URL`, `WHISPER_MODEL`, `WHISPER_API_KEY`):
  voice input goes to a self-hosted OpenAI-compatible transcription server
  instead of Mistral when the base URL is set.
