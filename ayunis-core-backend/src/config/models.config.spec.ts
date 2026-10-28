import { modelsConfig } from './models.config';

describe('modelsConfig stackit.baseURL', () => {
  const original = process.env.STACKIT_BASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.STACKIT_BASE_URL;
    else process.env.STACKIT_BASE_URL = original;
  });

  it.each([undefined, '', '  '])('uses the STACKIT cloud for %p', (value) => {
    if (value === undefined) delete process.env.STACKIT_BASE_URL;
    else process.env.STACKIT_BASE_URL = value;

    expect(modelsConfig().stackit.baseURL).toBe(
      'https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1',
    );
  });

  it('uses STACKIT_BASE_URL when set', () => {
    process.env.STACKIT_BASE_URL = ' https://llm.example.test/v1 ';

    expect(modelsConfig().stackit.baseURL).toBe('https://llm.example.test/v1');
  });
});
