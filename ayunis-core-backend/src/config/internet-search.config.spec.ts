import internetSearchConfig from './internet-search.config';

describe('internetSearchConfig with the searxng provider', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.INTERNET_SEARCH_PROVIDER = 'searxng';
    delete process.env.SEARXNG_URL;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('is available once SEARXNG_URL is set', () => {
    process.env.SEARXNG_URL = 'http://searxng.test:8080';

    const config = internetSearchConfig();

    expect(config.isAvailable).toBe(true);
    expect(config.searxng.url).toBe('http://searxng.test:8080');
  });

  it('is unavailable without SEARXNG_URL', () => {
    expect(internetSearchConfig().isAvailable).toBe(false);
  });
});
