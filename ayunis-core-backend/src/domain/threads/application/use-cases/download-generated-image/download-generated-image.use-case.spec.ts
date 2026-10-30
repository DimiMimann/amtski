import type { UUID } from 'crypto';
import { Readable } from 'stream';
import type { DownloadObjectUseCase } from 'src/domain/storage/application/use-cases/download-object/download-object.use-case';
import type { ThreadsRepository } from 'src/domain/threads/application/ports/threads.repository';
import type { GeneratedImagesRepository } from 'src/domain/threads/application/ports/generated-images.repository';
import { GeneratedImage } from 'src/domain/threads/domain/generated-image.entity';
import {
  GeneratedImageNotFoundError,
  ThreadNotFoundError,
  UnsupportedImageContentTypeError,
} from 'src/domain/threads/application/threads.errors';
import { DownloadGeneratedImageUseCase } from './download-generated-image.use-case';
import { DownloadGeneratedImageQuery } from './download-generated-image.query';

describe('DownloadGeneratedImageUseCase', () => {
  let useCase: DownloadGeneratedImageUseCase;
  let threadsRepository: jest.Mocked<ThreadsRepository>;
  let generatedImagesRepository: jest.Mocked<GeneratedImagesRepository>;
  let downloadObjectUseCase: jest.Mocked<DownloadObjectUseCase>;

  const userId = '123e4567-e89b-12d3-a456-426614174000' as UUID;
  const threadId = '123e4567-e89b-12d3-a456-426614174001' as UUID;
  const imageId = '123e4567-e89b-12d3-a456-426614174002' as UUID;
  const query = new DownloadGeneratedImageQuery(threadId, imageId, userId);

  const image = (contentType = 'image/png') =>
    new GeneratedImage(
      imageId,
      '00000000-0000-0000-0000-000000000000',
      userId,
      threadId,
      contentType,
      false,
      'generated-images/org/thread/image.png',
    );

  beforeEach(() => {
    threadsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: threadId }),
    } as unknown as jest.Mocked<ThreadsRepository>;
    generatedImagesRepository = {
      findByIdAndThreadId: jest.fn().mockResolvedValue(image()),
    } as unknown as jest.Mocked<GeneratedImagesRepository>;
    downloadObjectUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DownloadObjectUseCase>;

    useCase = new DownloadGeneratedImageUseCase(
      threadsRepository,
      generatedImagesRepository,
      downloadObjectUseCase,
    );
  });

  it('streams the image of an owned thread from storage', async () => {
    const stream = new Readable();
    downloadObjectUseCase.execute.mockResolvedValue(stream);

    const result = await useCase.execute(query);

    expect(result).toEqual({
      stream,
      contentType: 'image/png',
      filename: `${imageId}.png`,
    });
    expect(threadsRepository.findOne).toHaveBeenCalledWith(threadId, userId);
    expect(downloadObjectUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        objectName: 'generated-images/org/thread/image.png',
      }),
    );
  });

  it('rejects a thread the user does not own', async () => {
    threadsRepository.findOne.mockResolvedValue(null);

    await expect(useCase.execute(query)).rejects.toThrow(ThreadNotFoundError);
    expect(downloadObjectUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects an image that is not in the thread', async () => {
    generatedImagesRepository.findByIdAndThreadId.mockResolvedValue(null);

    await expect(useCase.execute(query)).rejects.toThrow(
      GeneratedImageNotFoundError,
    );
  });

  it('refuses to serve active content types', async () => {
    generatedImagesRepository.findByIdAndThreadId.mockResolvedValue(
      image('image/svg+xml'),
    );

    await expect(useCase.execute(query)).rejects.toThrow(
      UnsupportedImageContentTypeError,
    );
    expect(downloadObjectUseCase.execute).not.toHaveBeenCalled();
  });
});
