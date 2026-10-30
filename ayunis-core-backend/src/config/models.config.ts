import { registerAs } from '@nestjs/config';

// Evaluated lazily inside the registerAs factory so env vars are read after
// ConfigModule has loaded .env files.
const mistralConfig = () => ({
  apiKey: process.env.MISTRAL_API_KEY,
  // Default must be a model with the audio_transcription capability —
  // voxtral-small only supports audio chat, not /v1/audio/transcriptions.
  transcriptionModel:
    process.env.MISTRAL_TRANSCRIPTION_MODEL?.trim() || 'voxtral-mini-latest',
});

// A self-hosted OpenAI-compatible transcription server; replaces Mistral when set.
const whisperConfig = () => ({
  baseURL: process.env.WHISPER_BASE_URL?.trim() || undefined,
  model: process.env.WHISPER_MODEL?.trim() || 'openai/whisper-large-v3',
  apiKey: process.env.WHISPER_API_KEY?.trim() || undefined,
});

const stackitConfig = () => ({
  apiKey: process.env.STACKIT_TOKEN,
  // Overridable so a self-hosted OpenAI-compatible server can use this slot.
  baseURL:
    process.env.STACKIT_BASE_URL?.trim() ||
    'https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1',
});

export const modelsConfig = registerAs('models', () => ({
  mistral: mistralConfig(),
  whisper: whisperConfig(),
  // A self-hosted ComfyUI; serves the Azure image-generation slot when set.
  comfyui: { url: process.env.COMFYUI_URL?.trim() || undefined },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  bedrock: {
    awsRegion: process.env.AWS_BEDROCK_REGION,
    awsAccessKeyId: process.env.AWS_BEDROCK_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_BEDROCK_SECRET_ACCESS_KEY,
  },
  ollama: {
    baseURL: process.env.OLLAMA_BASE_URL,
  },
  synaforce: {
    baseURL:
      process.env.NODE_ENV === 'production'
        ? process.env.SYNAFORCE_BASE_URL
        : process.env.OLLAMA_BASE_URL,
  },
  ayunis: {
    baseURL: process.env.AYUNIS_BASE_URL,
    authToken: process.env.AYUNIS_AUTH_TOKEN,
  },
  otc: {
    apiKey: process.env.OTC_API_KEY,
    baseURL: 'https://llm-server.llmhub.t-systems.net/v2',
  },
  azure: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    imageApiVersion:
      process.env.AZURE_OPENAI_IMAGE_API_VERSION?.trim() ||
      '2025-04-01-preview',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  stackit: stackitConfig(),
  scaleway: {
    apiKey: process.env.SCALEWAY_API_KEY,
    baseURL: 'https://api.scaleway.ai/v1',
  },
}));
