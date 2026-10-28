import type { ConfigService } from '@nestjs/config';
import { SearxngInternetSearchHandler } from './searxng-internet-search.handler';
import { InternetSearchResult } from 'src/domain/retrievers/internet-search-retrievers/domain/internet-search-result.entity';
import { InternetSearchResultType } from 'src/domain/retrievers/internet-search-retrievers/domain/value-objects/internet-search-result-type.enum';

describe('SearxngInternetSearchHandler', () => {
  let handler: SearxngInternetSearchHandler;
  let searxngUrl: string | undefined;

  beforeEach(() => {
    searxngUrl = 'http://searxng.test:8080';
    const configService = {
      get: jest.fn((key: string) =>
        key === 'internetSearch.searxng.url' ? searxngUrl : undefined,
      ),
    };
    handler = new SearxngInternetSearchHandler(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockSearxngResponse(results: unknown[]): jest.SpyInstance {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results }),
    } as Response);
  }

  it('maps SearXNG results, using content as the description', async () => {
    mockSearxngResponse([
      {
        title: 'Rathaus Musterstadt',
        url: 'https://musterstadt.de/rathaus',
        content: 'Öffnungszeiten und Kontakt des Rathauses',
        engine: 'duckduckgo',
      },
    ]);

    const results = await handler.search('rathaus musterstadt öffnungszeiten');

    expect(results).toEqual([
      new InternetSearchResult({
        type: InternetSearchResultType.WEB,
        title: 'Rathaus Musterstadt',
        url: 'https://musterstadt.de/rathaus',
        description: 'Öffnungszeiten und Kontakt des Rathauses',
      }),
    ]);
  });

  it('requests the JSON API with the encoded query', async () => {
    const fetchSpy = mockSearxngResponse([]);

    await handler.search('Bürgeramt & Termine');

    const requestedUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      'http://searxng.test:8080/search',
    );
    expect(requestedUrl.searchParams.get('q')).toBe('Bürgeramt & Termine');
    expect(requestedUrl.searchParams.get('format')).toBe('json');
  });

  it('skips results missing a title, url, or content and keeps at most 10', async () => {
    mockSearxngResponse([
      { title: '', url: 'https://x.de', content: 'no title' },
      { title: 'no content', url: 'https://y.de' },
      ...Array.from({ length: 12 }, (_, i) => ({
        title: `r${i}`,
        url: `https://r${i}.de`,
        content: 'kept',
      })),
    ]);

    const results = await handler.search('q');

    expect(results).toHaveLength(10);
    expect(results[0].title).toBe('r0');
  });

  it('throws when SearXNG answers with an HTTP error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'json format disabled',
    } as Response);

    await expect(handler.search('q')).rejects.toThrow(
      'SearXNG search failed with status 403',
    );
  });

  it('throws when no SearXNG URL is configured', async () => {
    searxngUrl = undefined;

    await expect(handler.search('q')).rejects.toThrow(
      'SearXNG URL is not configured',
    );
  });
});
