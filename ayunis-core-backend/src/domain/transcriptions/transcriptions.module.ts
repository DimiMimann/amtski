import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranscriptionsController } from './presenters/http/transcriptions.controller';
import { TranscribeUseCase } from './application/use-cases/transcribe/transcribe.use-case';
import { TranscriptionPort } from './application/ports/transcription.port';
import { MistralTranscriptionService } from './infrastructure/mistral-transcription.service';
import { WhisperTranscriptionService } from './infrastructure/whisper-transcription.service';
import { ContextModule } from 'src/common/context/context.module';

export const selectTranscriptionPort = (
  configService: ConfigService,
  mistral: MistralTranscriptionService,
  whisper: WhisperTranscriptionService,
): TranscriptionPort =>
  configService.get<string>('models.whisper.baseURL') ? whisper : mistral;

@Module({
  imports: [ContextModule],
  controllers: [TranscriptionsController],
  providers: [
    TranscribeUseCase,
    MistralTranscriptionService,
    WhisperTranscriptionService,
    {
      provide: TranscriptionPort,
      inject: [
        ConfigService,
        MistralTranscriptionService,
        WhisperTranscriptionService,
      ],
      useFactory: selectTranscriptionPort,
    },
  ],
  exports: [TranscriptionPort, TranscribeUseCase],
})
export class TranscriptionsModule {}
