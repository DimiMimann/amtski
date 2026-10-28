import type { ConfigService } from '@nestjs/config';
import { WhisperTranscriptionService } from './whisper-transcription.service';
import { InvalidAudioFileError } from 'src/domain/transcriptions/application/transcription.errors';

describe('WhisperTranscriptionService', () => {
  const config: Record<string, string | undefined> = {
    'models.whisper.baseURL': 'http://whisper.test:8005/v1',
    'models.whisper.model': 'openai/whisper-large-v3',
    'models.whisper.apiKey': undefined,
  };
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService;
  let fetchSpy: jest.SpyInstance;

  // A fresh Response per call: a body can only be read once.
  function respond(status: number, body: unknown): void {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  }

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the audio to the transcriptions endpoint and returns the trimmed text', async () => {
    respond(200, { text: ' Guten Tag, Bürgeramt. ' });
    const service = new WhisperTranscriptionService(configService);

    const text = await service.transcribe(
      Buffer.from('RIFF'),
      'diktat.wav',
      'audio/wav',
      'de',
    );

    expect(text).toBe('Guten Tag, Bürgeramt.');
    // The SDK first probes multipart support with fetch('data:,').
    const call = fetchSpy.mock.calls.find(([url]) =>
      String(url).endsWith('/audio/transcriptions'),
    ) as [string, RequestInit];
    expect(call[0]).toBe('http://whisper.test:8005/v1/audio/transcriptions');
    const form = call[1].body as FormData;
    expect(form.get('model')).toBe('openai/whisper-large-v3');
    expect(form.get('language')).toBe('de');
  });

  it('reports audio the server rejects as an invalid audio file', async () => {
    respond(400, { error: { message: 'Invalid or unsupported audio file.' } });
    const service = new WhisperTranscriptionService(configService);

    await expect(
      service.transcribe(Buffer.from('x'), 'broken.wav', 'audio/wav'),
    ).rejects.toBeInstanceOf(InvalidAudioFileError);
  });
});
