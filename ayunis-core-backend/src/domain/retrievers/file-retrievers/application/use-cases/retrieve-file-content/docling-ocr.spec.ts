import { Test } from '@nestjs/testing';
import { ContextService } from 'src/common/context/services/context.service';
import retrievalConfig from 'src/config/retrieval.config';
import { FileRetrieverRegistry } from 'src/domain/retrievers/file-retrievers/application/file-retriever-handler.registry';
import { UnprocessableDocumentError } from 'src/domain/retrievers/file-retrievers/application/file-retriever.errors';
import { DocumentConverterPort } from 'src/domain/retrievers/file-retrievers/application/ports/document-converter.port';
import { MsgParserPort } from 'src/domain/retrievers/file-retrievers/application/ports/msg-parser.port';
import { PreflightCheckUseCase } from 'src/domain/retrievers/file-retrievers/application/use-cases/preflight-check/preflight-check.use-case';
import {
  FileRetrieverPage,
  FileRetrieverResult,
} from 'src/domain/retrievers/file-retrievers/domain/file-retriever-result.entity';
import { FileRetrieverType } from 'src/domain/retrievers/file-retrievers/domain/value-objects/file-retriever-type.enum';
import { TranscribeUseCase } from 'src/domain/transcriptions/application/use-cases/transcribe/transcribe.use-case';
import { RetrieveFileContentCommand } from './retrieve-file-content.command';
import { RetrieveFileContentUseCase } from './retrieve-file-content.use-case';

describe('PDF OCR with Docling', () => {
  const handlers = {
    [FileRetrieverType.DOCLING]: { processFile: jest.fn() },
    [FileRetrieverType.MISTRAL]: { processFile: jest.fn() },
    [FileRetrieverType.NPM_PDF_PARSE]: { processFile: jest.fn() },
  };
  const config = {
    processingMaxPdfPages: 1000,
    mistral: { apiKey: undefined as string | undefined },
    docling: { url: 'http://docling.test:5001' as string | undefined },
  };
  let useCase: RetrieveFileContentUseCase;

  const scan = (text: string) =>
    new FileRetrieverResult([new FileRetrieverPage(text, 1)]);
  const pdfCommand = (pdfPageLimit?: number) =>
    new RetrieveFileContentCommand({
      fileData: Buffer.from('%PDF-1.7 scanned'),
      fileName: 'antrag.pdf',
      fileType: 'application/pdf',
      pdfPageLimit,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RetrieveFileContentUseCase,
        { provide: retrievalConfig.KEY, useValue: config },
        {
          provide: FileRetrieverRegistry,
          useValue: { getHandler: (type: FileRetrieverType) => handlers[type] },
        },
        { provide: ContextService, useValue: { get: () => 'municipality-id' } },
        { provide: DocumentConverterPort, useValue: {} },
        { provide: MsgParserPort, useValue: {} },
        { provide: TranscribeUseCase, useValue: {} },
        { provide: PreflightCheckUseCase, useValue: {} },
      ],
    }).compile();
    useCase = module.get(RetrieveFileContentUseCase);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    config.mistral.apiKey = undefined;
    config.docling.url = 'http://docling.test:5001';
  });

  it('runs PDFs through Docling OCR with the page limit when a Docling URL is set', async () => {
    handlers.docling.processFile.mockResolvedValue(scan('Bürgeramt'));

    const result = await useCase.execute(pdfCommand(5));

    expect(result.pages[0].text).toBe('Bürgeramt');
    expect(handlers.docling.processFile).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'antrag.pdf' }),
      { pageLimit: 5 },
    );
    expect(handlers['npm-pdf-parse'].processFile).not.toHaveBeenCalled();
  });

  it('prefers Docling over Mistral when both are configured', async () => {
    config.mistral.apiKey = 'mistral-key';
    handlers.docling.processFile.mockResolvedValue(scan('Bürgeramt'));

    await useCase.execute(pdfCommand());

    expect(handlers.mistral.processFile).not.toHaveBeenCalled();
  });

  it('falls back to local PDF parsing when Docling cannot read the document', async () => {
    handlers.docling.processFile.mockRejectedValue(
      new UnprocessableDocumentError('The document could not be processed'),
    );
    handlers['npm-pdf-parse'].processFile.mockResolvedValue(scan('text layer'));

    const result = await useCase.execute(pdfCommand());

    expect(result.pages[0].text).toBe('text layer');
  });

  it('keeps local PDF parsing without Docling or Mistral', async () => {
    config.docling.url = undefined;
    handlers['npm-pdf-parse'].processFile.mockResolvedValue(scan('text layer'));

    await useCase.execute(pdfCommand());

    expect(handlers.docling.processFile).not.toHaveBeenCalled();
  });
});
