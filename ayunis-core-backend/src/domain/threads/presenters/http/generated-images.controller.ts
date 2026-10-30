import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Logger,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { UUID } from 'crypto';
import { Response } from 'express';
import { Readable } from 'stream';
import {
  CurrentUser,
  UserProperty,
} from 'src/iam/authentication/application/decorators/current-user.decorator';
import { ResolveGeneratedImageUseCase } from 'src/domain/threads/application/use-cases/resolve-generated-image/resolve-generated-image.use-case';
import { ResolveGeneratedImageQuery } from 'src/domain/threads/application/use-cases/resolve-generated-image/resolve-generated-image.query';
import { GeneratedImageUrlResponseDto } from './dto/generated-image-url-response.dto';
import { DownloadGeneratedImageUseCase } from 'src/domain/threads/application/use-cases/download-generated-image/download-generated-image.use-case';
import { DownloadGeneratedImageQuery } from 'src/domain/threads/application/use-cases/download-generated-image/download-generated-image.query';

@ApiTags('threads')
@Controller('threads')
export class GeneratedImagesController {
  private readonly logger = new Logger(GeneratedImagesController.name);

  constructor(
    private readonly resolveGeneratedImageUseCase: ResolveGeneratedImageUseCase,
    private readonly downloadGeneratedImageUseCase: DownloadGeneratedImageUseCase,
  ) {}

  @Get(':threadId/generated-images/:imageId')
  @ApiOperation({ summary: 'Get presigned URL for a generated image' })
  @ApiParam({ name: 'threadId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'imageId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL for the generated image',
    type: GeneratedImageUrlResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Thread or image not found' })
  async resolve(
    @CurrentUser(UserProperty.ID) userId: UUID,
    @Param('threadId', ParseUUIDPipe) threadId: UUID,
    @Param('imageId', ParseUUIDPipe) imageId: UUID,
  ): Promise<GeneratedImageUrlResponseDto> {
    this.logger.log({ threadId, imageId }, 'resolve');

    return this.resolveGeneratedImageUseCase.execute(
      new ResolveGeneratedImageQuery(threadId, imageId, userId),
    );
  }

  // Loaded only through the URL that resolve() returns, as an <img> source,
  // never through the generated API client.
  @Get(':threadId/generated-images/:imageId/content')
  @ApiExcludeEndpoint()
  async download(
    @CurrentUser(UserProperty.ID) userId: UUID,
    @Param('threadId', ParseUUIDPipe) threadId: UUID,
    @Param('imageId', ParseUUIDPipe) imageId: UUID,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.logger.log({ threadId, imageId }, 'download');

    const download = await this.downloadGeneratedImageUseCase.execute(
      new DownloadGeneratedImageQuery(threadId, imageId, userId),
    );

    res.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(download.stream as unknown as Readable, {
      type: download.contentType,
      disposition: `inline; filename="${download.filename}"`,
    });
  }
}
