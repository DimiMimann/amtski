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
