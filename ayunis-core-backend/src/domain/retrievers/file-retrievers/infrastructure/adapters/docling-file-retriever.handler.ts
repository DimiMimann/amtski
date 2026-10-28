import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileRetrieverHandler,
  type FileRetrieverProcessOptions,
} from 'src/domain/retrievers/file-retrievers/application/ports/file-retriever.handler';
import {
  FileRetrieverPage,
  FileRetrieverResult,
} from 'src/domain/retrievers/file-retrievers/domain/file-retriever-result.entity';
import {
  EmptyOcrResultError,
  FileRetrieverUnexpectedError,
  UnprocessableDocumentError,
} from 'src/domain/retrievers/file-retrievers/application/file-retriever.errors';
import { File } from 'src/domain/retrievers/file-retrievers/domain/file.entity';
import { ApplicationError } from 'src/common/errors/base.error';
import { ProviderTimeoutError } from 'src/common/errors/provider.errors';
import { wrapProviderFailure } from 'src/common/errors/wrap-provider-failure.helper';

const PROVIDER = { provider: 'docling', modelId: 'docling-serve' };
const POLL_INTERVAL_MS = 2_000;
// The async API has no server-side wait limit, unlike the sync one (~120 s);
// at ~1 s per scanned page this covers the 1000-page cap.
const MAX_WAIT_MS = 30 * 60_000;

type DoclingRef = { $ref: string };

type DoclingNode = {
  text?: string;
  prov?: Array<{ page_no: number }>;
  children?: DoclingRef[];
  data?: { grid?: Array<Array<{ text: string }>> };
};

type DoclingDocument = { body: DoclingNode } & Partial<
  Record<'texts' | 'tables' | 'pictures' | 'groups', DoclingNode[]>
>;

type DoclingTask = { task_id: string; task_status: string };

type DoclingResult = {
  status: string;
  document?: { json_content?: DoclingDocument | null };
};

/** OCR through a self-hosted docling-serve, using its async convert API. */
@Injectable()
export class DoclingFileRetrieverHandler extends FileRetrieverHandler {
  private readonly logger = new Logger(DoclingFileRetrieverHandler.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async processFile(
    file: File,
    options?: FileRetrieverProcessOptions,
  ): Promise<FileRetrieverResult> {
    try {
      const taskId = await this.submit(file, options?.pageLimit);
      await this.waitForTask(taskId);
      const result = await this.request<DoclingResult>(`/v1/result/${taskId}`);
      return toFileRetrieverResult(result);
    } catch (error) {
      this.logger.error(
        { err: error as Error, fileName: file.filename },
        'Docling OCR processing failed',
      );
      throw mapProcessingError(error);
    }
  }

  private async submit(file: File, pageLimit?: number): Promise<string> {
    const form = new FormData();
    form.append(
      'files',
      new Blob([new Uint8Array(file.fileData)], { type: file.fileType }),
      file.filename,
    );
    // JSON, not Markdown: the Markdown export drops OCR text the layout model
    // files under a picture, which happens to whole scanned pages.
    form.append('to_formats', 'json');
    form.append('image_export_mode', 'placeholder');
    if (pageLimit !== undefined) {
      form.append('page_range', '1');
      form.append('page_range', String(pageLimit));
    }
    const task = await this.request<DoclingTask>('/v1/convert/file/async', {
      method: 'POST',
      body: form,
    });
    return task.task_id;
  }

  private async waitForTask(taskId: string): Promise<void> {
    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      const task = await this.request<DoclingTask>(`/v1/status/poll/${taskId}`);
      if (task.task_status === 'success') return;
      if (task.task_status === 'failure') {
        throw new Error(`Docling task ${taskId} failed`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new ProviderTimeoutError(PROVIDER);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = this.configService.get<string>('retrieval.docling.url');
    const response = await fetch(new URL(path, baseUrl).toString(), init);
    if (!response.ok) {
      // `status` lets wrapProviderFailure classify 5xx and 429 as outages.
      throw Object.assign(
        new Error(`Docling responded with HTTP ${response.status}`),
        { status: response.status },
      );
    }
    return (await response.json()) as T;
  }
}

function mapProcessingError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) return error;
  return (
    wrapProviderFailure(error, PROVIDER) ??
    new FileRetrieverUnexpectedError(error as Error, {
      model: PROVIDER.modelId,
    })
  );
}

function toFileRetrieverResult(result: DoclingResult): FileRetrieverResult {
  const document = result.document?.json_content;
  if (result.status !== 'success' || !document) {
    throw new UnprocessableDocumentError(
      'The document could not be processed',
      { model: PROVIDER.modelId, status: result.status },
    );
  }
  const pages = collectPages(document);
  if (pages.length === 0) {
    throw new EmptyOcrResultError({ model: PROVIDER.modelId, pageCount: 0 });
  }
  return new FileRetrieverResult(pages, { model: PROVIDER.modelId });
}

/** Walks the body in reading order, grouping item text by page. */
function collectPages(document: DoclingDocument): FileRetrieverPage[] {
  const pages = new Map<number, string[]>();
  const visit = (node: DoclingNode): void => {
    const text = nodeText(node);
    const pageNo = node.prov?.[0]?.page_no;
    if (text && pageNo !== undefined) {
      pages.set(pageNo, [...(pages.get(pageNo) ?? []), text]);
    }
    for (const ref of node.children ?? []) {
      const child = resolveRef(document, ref);
      if (child) visit(child);
    }
  };
  visit(document.body);
  return [...pages.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([pageNo, parts]) => new FileRetrieverPage(parts.join('\n\n'), pageNo),
    );
}

function nodeText(node: DoclingNode): string | undefined {
  const grid = node.data?.grid;
  if (grid) {
    return grid
      .map((row) => row.map((cell) => cell.text).join(' | '))
      .join('\n');
  }
  return node.text?.trim();
}

function resolveRef(
  document: DoclingDocument,
  ref: DoclingRef,
): DoclingNode | undefined {
  const [, collection, index] = ref.$ref.split('/');
  if (!['texts', 'tables', 'pictures', 'groups'].includes(collection)) {
    return undefined;
  }
  const items = document[collection as keyof Omit<DoclingDocument, 'body'>];
  return items?.[Number(index)];
}
