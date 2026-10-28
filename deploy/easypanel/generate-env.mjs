// Prints a complete Environment block for compose.easypanel.yml with fresh
// secrets. Usage: node deploy/easypanel/generate-env.mjs https://ai.example.org
// Paste the output into the Compose service's Environment tab, then replace
// the <...> placeholders. Keep a copy offline: MCP_ENCRYPTION_KEY and
// MFA_ENCRYPTION_KEY cannot be rotated; losing them makes stored MCP
// credentials and MFA secrets unreadable.
import { randomBytes } from 'node:crypto';

const publicUrl = process.argv[2];
if (!publicUrl?.startsWith('https://')) {
  console.error('Usage: node generate-env.mjs https://<public host>');
  process.exit(1);
}

const secret = (bytes = 32) => randomBytes(bytes).toString('hex');

console.log(`PUBLIC_URL=${publicUrl}
PUBLIC_HOST=${new URL(publicUrl).hostname}
SOURCE_CODE_URL=<public repository URL of the deployed source>
TRUST_PROXY=2
DISABLE_REGISTRATION=false

JWT_SECRET=${secret()}
COOKIE_SECRET=${secret()}
MCP_ENCRYPTION_KEY=${secret()}
MFA_ENCRYPTION_KEY=${secret()}
METRICS_USER=metrics
METRICS_PASSWORD=${secret(24)}

POSTGRES_USER=ayunis
POSTGRES_PASSWORD=${secret(24)}
POSTGRES_DB=ayunis
REDIS_PASSWORD=${secret(24)}
MINIO_ROOT_USER=ayunis
MINIO_ROOT_PASSWORD=${secret(24)}

LLM_BASE_URL=<http://host:port/v1 of the OpenAI-compatible chat server>
LLM_API_KEY=<API key of the chat server>
EMBEDDINGS_BASE_URL=<http://host:port/v1 of the OpenAI-compatible embedding server>
EMBEDDINGS_API_KEY=local

SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASSWORD=`);
