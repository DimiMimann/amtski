import type { ConfigService } from '@nestjs/config';
import { DoclingFileRetrieverHandler } from './docling-file-retriever.handler';
import { File } from 'src/domain/retrievers/file-retrievers/domain/file.entity';
import {
  EmptyOcrResultError,
  UnprocessableDocumentError,
} from 'src/domain/retrievers/file-retrievers/application/file-retriever.errors';
import { ProviderUnavailableError } from 'src/common/errors/provider.errors';

const BASE = 'http://docling.test:5001';

// Trimmed from a real docling-serve 1.32 response: the layout model filed the
// OCR text of page 1 under a picture.
const SCANNED_DOCUMENT = {
  body: {
    children: [
      { $ref: '#/pictures/0' },
      { $ref: '#/texts/2' },
      { $ref: '#/tables/0' },
    ],
  },
  pictures: [
    {
      prov: [{ page_no: 1 }],
      children: [{ $ref: '#/texts/0' }, { $ref: '#/texts/1' }],
    },
  ],
  texts: [
    { text: 'Stadt Musterstadt - Bürgeramt', prov: [{ page_no: 1 }] },
    { text: 'Antrag auf Personalausweis', prov: [{ page_no: 1 }] },
    { text: 'Gebühren', prov: [{ page_no: 2 }] },
  ],
  tables: [
    {
      prov: [{ page_no: 2 }],
      data: {
        grid: [
          [{ text: 'Leistung' }, { text: 'Gebühr' }],
          [{ text: 'Personalausweis' }, { text: '37,00 €' }],
        ],
      },
    },
  ],
};

describe('DoclingFileRetrieverHandler', () => {
  const handler = new DoclingFileRetrieverHandler({
    get: () => BASE,
  } as unknown as ConfigService);
  const scan = new File(
    Buffer.from('%PDF-1.7'),
    'antrag.pdf',
    'application/pdf',
  );
  let fetchSpy: jest.SpyInstance;

  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );

  function serve(
    result: unknown,
    polls: string[] = ['success'],
    submitStatus = 200,
  ): void {
    fetchSpy.mockImplementation((url: string) => {
      if (url.endsWith('/v1/convert/file/async')) {
        return json({ task_id: 't1', task_status: 'pending' }, submitStatus);
      }
      if (url.includes('/v1/status/poll/t1')) {
        return json({ task_id: 't1', task_status: polls.shift() });
      }
      return json(result);
    });
  }

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('collects text per page, including OCR text under pictures and tables', async () => {
    serve({
      status: 'success',
      document: { json_content: SCANNED_DOCUMENT },
    });

    const result = await handler.processFile(scan);

    expect(result.pages.map((page) => [page.number, page.text])).toEqual([
      [1, 'Stadt Musterstadt - Bürgeramt\n\nAntrag auf Personalausweis'],
      [2, 'Gebühren\n\nLeistung | Gebühr\nPersonalausweis | 37,00 €'],
    ]);
  });

  it('asks for JSON output and limits the page range', async () => {
    serve({ status: 'success', document: { json_content: SCANNED_DOCUMENT } });

    await handler.processFile(scan, { pageLimit: 3 });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/convert/file/async`);
    const form = init.body as FormData;
    expect(form.get('to_formats')).toBe('json');
    expect(form.getAll('page_range')).toEqual(['1', '3']);
  });

  it('polls until the conversion task has finished', async () => {
    jest.useFakeTimers();
    serve({ status: 'success', document: { json_content: SCANNED_DOCUMENT } }, [
      'started',
      'started',
      'success',
    ]);

    const processing = handler.processFile(scan);
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(processing).resolves.toHaveProperty('pages.length', 2);
  });

  it('reports a document Docling cannot convert as unprocessable', async () => {
    serve({ status: 'failure', document: { json_content: null } });

    await expect(handler.processFile(scan)).rejects.toBeInstanceOf(
      UnprocessableDocumentError,
    );
  });

  it('reports a document without any text as an empty OCR result', async () => {
    serve({
      status: 'success',
      document: { json_content: { body: { children: [] } } },
    });

    await expect(handler.processFile(scan)).rejects.toBeInstanceOf(
      EmptyOcrResultError,
    );
  });

  it('reports a Docling server error as a provider outage', async () => {
    serve({}, [], 503);

    await expect(handler.processFile(scan)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });
});
