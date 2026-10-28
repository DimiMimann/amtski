import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternetSearchHandler } from 'src/domain/retrievers/internet-search-retrievers/application/ports/internet-search.handler';
import { InternetSearchResult } from 'src/domain/retrievers/internet-search-retrievers/domain/internet-search-result.entity';
import { InternetSearchResultType } from 'src/domain/retrievers/internet-search-retrievers/domain/value-objects/internet-search-result-type.enum';

const MAX_RESULTS = 10;

type SearxngSearchResult = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
};

/** Self-hosted SearXNG metasearch; requires `json` in its search.formats. */
@Injectable()
export class SearxngInternetSearchHandler implements InternetSearchHandler {
  private readonly logger = new Logger(SearxngInternetSearchHandler.name);

  constructor(private readonly configService: ConfigService) {}

  async search(query: string): Promise<InternetSearchResult[]> {
    this.logger.debug(
      { input: query },
      'Using SearXNG internet search handler',
    );

    const response = await fetch(this.buildUrl(query), {
      headers: { Accept: 'application/json' },
    });

    // fetch does not throw on HTTP error status — check explicitly.
    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(
        { status: response.status, response: detail },
        'SearXNG search error',
      );
      throw new Error(`SearXNG search failed with status ${response.status}`);
    }

    const data = (await response.json()) as SearxngSearchResult;
    return this.mapResults(data);
  }

  private buildUrl(query: string): string {
    const baseUrl = this.configService.get<string>(
      'internetSearch.searxng.url',
    );
    if (!baseUrl) {
      throw new Error('SearXNG URL is not configured');
    }
    const url = new URL('/search', baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    return url.toString();
  }

  private mapResults(data: SearxngSearchResult): InternetSearchResult[] {
    return (data.results ?? [])
      .filter((result) => result.title && result.url && result.content)
      .slice(0, MAX_RESULTS)
      .map(
        (result) =>
          new InternetSearchResult({
            type: InternetSearchResultType.WEB,
            title: result.title!,
            url: result.url!,
            description: result.content!,
          }),
      );
  }
}
