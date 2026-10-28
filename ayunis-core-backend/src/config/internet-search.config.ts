import { registerAs } from '@nestjs/config';

export default registerAs('internetSearch', () => {
  const provider = process.env.INTERNET_SEARCH_PROVIDER ?? 'brave';
  const braveAvailable =
    !!process.env.BRAVE_SEARCH_URL && !!process.env.BRAVE_SEARCH_API_KEY;
  const staanAvailable = !!process.env.STAAN_SEARCH_API_KEY;
  const availability: Record<string, boolean> = {
    staan: staanAvailable,
    searxng: !!process.env.SEARXNG_URL,
  };

  return {
    provider,
    isAvailable: availability[provider] ?? braveAvailable,
    brave: {
      url: process.env.BRAVE_SEARCH_URL,
      apiKey: process.env.BRAVE_SEARCH_API_KEY,
    },
    staan: {
      url: process.env.STAAN_SEARCH_URL,
      apiKey: process.env.STAAN_SEARCH_API_KEY,
      market: process.env.STAAN_SEARCH_MARKET,
    },
    searxng: {
      url: process.env.SEARXNG_URL,
    },
  };
});
