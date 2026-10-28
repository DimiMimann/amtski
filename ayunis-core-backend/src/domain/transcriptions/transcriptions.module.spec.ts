import type { ConfigService } from '@nestjs/config';
import { selectTranscriptionPort } from './transcriptions.module';
import type { MistralTranscriptionService } from './infrastructure/mistral-transcription.service';
import type { WhisperTranscriptionService } from './infrastructure/whisper-transcription.service';

describe('selectTranscriptionPort', () => {
  const mistral = { name: 'mistral' } as unknown as MistralTranscriptionService;
  const whisper = { name: 'whisper' } as unknown as WhisperTranscriptionService;
  const withWhisperUrl = (url: string | undefined) =>
    ({ get: jest.fn(() => url) }) as unknown as ConfigService;

  it('uses Whisper when a Whisper base URL is configured', () => {
    expect(
      selectTranscriptionPort(
        withWhisperUrl('http://whisper.test/v1'),
        mistral,
        whisper,
      ),
    ).toBe(whisper);
  });

  it('keeps Mistral otherwise', () => {
    expect(
      selectTranscriptionPort(withWhisperUrl(undefined), mistral, whisper),
    ).toBe(mistral);
  });
});
