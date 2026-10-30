import type { UUID } from 'crypto';
import { ResolveGeneratedImageUseCase } from './resolve-generated-image.use-case';
import { ResolveGeneratedImageQuery } from './resolve-generated-image.query';
import type { ThreadsRepository } from 'src/domain/threads/application/ports/threads.repository';
import type { GeneratedImagesRepository } from 'src/domain/threads/application/ports/generated-images.repository';
import {
  ThreadNotFoundError,
  GeneratedImageNotFoundError,
} from 'src/domain/threads/application/threads.errors';
import { GeneratedImage } from 'src/domain/threads/domain/generated-image.entity';

describe('ResolveGeneratedImageUseCase', () => {
  let useCase: ResolveGeneratedImageUseCase;
  let threadsRepository: jest.Mocked<ThreadsRepository>;
  let generatedImagesRepository: jest.Mocked<GeneratedImagesRepository>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000' as UUID;
  const mockThreadId = '123e4567-e89b-12d3-a456-426614174001' as UUID;
  const mockImageId = '123e4567-e89b-12d3-a456-426614174002' as UUID;

  beforeEach(() => {
    threadsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ThreadsRepository>;

    generatedImagesRepository = {
      save: jest.fn(),
      findByIdAndThreadId: jest.fn(),
    } as unknown as jest.Mocked<GeneratedImagesRepository>;

    useCase = new ResolveGeneratedImageUseCase(
      threadsRepository,
      generatedImagesRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return the backend content URL when thread and image exist', async () => {
      const query = new ResolveGeneratedImageQuery(
        mockThreadId,
        mockImageId,
        mockUserId,
      );

      threadsRepository.findOne.mockResolvedValue({
        id: mockThreadId,
      } as ReturnType<typeof threadsRepository.findOne> extends Promise<infer R>
        ? R
        : never);

      const mockImage = new GeneratedImage(
        mockImageId,
        '00000000-0000-0000-0000-000000000000',
        mockUserId,
        mockThreadId,
        'image/png',
        false,
        'generated-images/org/thread/image.png',
      );
      generatedImagesRepository.findByIdAndThreadId.mockResolvedValue(
        mockImage,
      );

      const result = await useCase.execute(query);

      expect(result.url).toBe(
        `/api/threads/${mockThreadId}/generated-images/${mockImageId}/content`,
      );
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(threadsRepository.findOne).toHaveBeenCalledWith(
        mockThreadId,
        mockUserId,
      );
    });

    it('should throw ThreadNotFoundError when thread not found for user', async () => {
      const query = new ResolveGeneratedImageQuery(
        mockThreadId,
        mockImageId,
        mockUserId,
      );

      threadsRepository.findOne.mockResolvedValue(null);

      await expect(useCase.execute(query)).rejects.toThrow(ThreadNotFoundError);
    });

    it('should throw GeneratedImageNotFoundError when image not found in thread', async () => {
      const query = new ResolveGeneratedImageQuery(
        mockThreadId,
        mockImageId,
        mockUserId,
      );

      threadsRepository.findOne.mockResolvedValue({
        id: mockThreadId,
      } as ReturnType<typeof threadsRepository.findOne> extends Promise<infer R>
        ? R
        : never);
      generatedImagesRepository.findByIdAndThreadId.mockResolvedValue(null);

      await expect(useCase.execute(query)).rejects.toThrow(
        GeneratedImageNotFoundError,
      );
    });
  });
});
