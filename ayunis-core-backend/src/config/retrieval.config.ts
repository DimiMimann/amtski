import { registerAs } from '@nestjs/config';

export interface RetrievalConfig {
  mistral: {
    apiKey: string | undefined;
    serverUrl: string | undefined;
  };
  // A self-hosted docling-serve; replaces Mistral OCR when set.
  docling: {
    url: string | undefined;
  };
  processingMaxPdfPages: number;
}

export default registerAs('retrieval', (): RetrievalConfig => ({
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    serverUrl: process.env.MISTRAL_OCR_SERVER_URL,
  },
  docling: {
    url: process.env.DOCLING_URL?.trim() || undefined,
  },
  // Mistral OCR rejects documents above 1000 pages — enforce the cap
  // before OCR so oversized documents fail fast with a clear error.
  processingMaxPdfPages: parseInt(
    process.env.PROCESSING_MAX_PDF_PAGES || '1000',
    10,
  ),
}));
