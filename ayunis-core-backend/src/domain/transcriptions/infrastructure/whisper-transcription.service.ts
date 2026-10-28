import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError, toFile } from 'openai';
import { TranscriptionPort } from 'src/domain/transcriptions/application/ports/transcription.port';
import {
  InvalidAudioFileError,
  TranscriptionFailedError,
} from 'src/domain/transcriptions/application/transcription.errors';
import { wrapProviderFailure } from 'src/common/errors/wrap-provider-failure.helper';

// Dictations run up to the 25 MB upload limit; the SDK retries transient errors.
const WHISPER_TIMEOUT_MS = 180_000;

@Injectable()
export class WhisperTranscriptionService extends TranscriptionPort {
  private readonly logger = new Logger(WhisperTranscriptionService.name);

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(configService: ConfigService) {
    super();
    this.client = new OpenAI({
      baseURL: configService.get<string>('models.whisper.baseURL'),
      // Self-hosted servers often need no key, but the SDK requires one.
      apiKey: configService.get<string>('models.whisper.apiKey') ?? 'local',
      timeout: WHISPER_TIMEOUT_MS,
    });
    this.model = configService.get<string>(
      'models.whisper.model',
      'openai/whisper-large-v3',
    );
  }

  async transcribe(
    file: Buffer,
    fileName: string,
    mimeType: string,
    language?: string,
  ): Promise<string> {
    this.logger.log(
      { fileName, fileSize: file.length, mimeType, language },
      'Starting transcription',
    );

    try {
      const response = await this.client.audio.transcriptions.create({
        file: await toFile(file, fileName, { type: mimeType }),
        model: this.model,
        ...(language && { language }),
      });
      const text = response.text.trim();

      this.logger.log(
        { fileName, textLength: text.length },
        'Transcription completed successfully',
      );
      return text;
    } catch (error) {
      this.logger.error(
        { err: error as Error, fileName },
        'Transcription failed',
      );

      const providerError = wrapProviderFailure(error, {
        provider: 'whisper',
        modelId: this.model,
      });
      if (providerError) throw providerError;
      if (error instanceof APIError && error.status === 400) {
        throw new InvalidAudioFileError();
      }
      throw new TranscriptionFailedError(
        `Whisper transcription failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
