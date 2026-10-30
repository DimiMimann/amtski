import { Injectable, Logger } from '@nestjs/common';
import { ApplicationError } from 'src/common/errors/base.error';
import { ThreadsRepository } from 'src/domain/threads/application/ports/threads.repository';
import { GeneratedImagesRepository } from 'src/domain/threads/application/ports/generated-images.repository';
import {
  ThreadNotFoundError,
  GeneratedImageNotFoundError,
} from 'src/domain/threads/application/threads.errors';
import { ResolveGeneratedImageQuery } from './resolve-generated-image.query';

// The URL itself never expires; this paces the client's re-resolution.
const URL_EXPIRY_SECONDS = 3600;

export interface ResolveGeneratedImageResult {
  url: string;
  expiresAt: string;
}

@Injectable()
export class ResolveGeneratedImageUseCase {
  private readonly logger = new Logger(ResolveGeneratedImageUseCase.name);

  constructor(
    private readonly threadsRepository: ThreadsRepository,
    private readonly generatedImagesRepository: GeneratedImagesRepository,
  ) {}

  async execute(
    query: ResolveGeneratedImageQuery,
  ): Promise<ResolveGeneratedImageResult> {
    const logContext = {
      threadId: query.threadId,
      imageId: query.imageId,
    };
    this.logger.log(logContext, 'execute');

    try {
      const thread = await this.threadsRepository.findOne(
        query.threadId,
        query.userId,
      );
      if (!thread) {
        throw new ThreadNotFoundError(query.threadId, query.userId);
      }

      const image = await this.generatedImagesRepository.findByIdAndThreadId(
        query.imageId,
        query.threadId,
      );
      if (!image) {
        throw new GeneratedImageNotFoundError(query.imageId);
      }

      // Served by the backend (DownloadGeneratedImageUseCase) rather than a
      // presigned storage URL: the object storage is not reachable from
      // browsers in self-hosted deployments. Same-origin, so the session
      // cookie authorizes the request.
      // ponytail: assumes the production '/api' prefix on the frontend origin.
      return {
        url: `/api/threads/${query.threadId}/generated-images/${image.id}/content`,
        expiresAt: new Date(
          Date.now() + URL_EXPIRY_SECONDS * 1000,
        ).toISOString(),
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      this.logger.error(
        { ...logContext, err: error as Error },
        'Failed to resolve generated image',
      );
      throw error;
    }
  }
}
