import toolsConfig from './tools.config';

describe('toolsConfig codeExecution.enabled', () => {
  const original = process.env.CODE_EXECUTION_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.CODE_EXECUTION_ENABLED;
    else process.env.CODE_EXECUTION_ENABLED = original;
  });

  it.each([undefined, '', 'true'])('is enabled for %p', (value) => {
    if (value === undefined) delete process.env.CODE_EXECUTION_ENABLED;
    else process.env.CODE_EXECUTION_ENABLED = value;

    expect(toolsConfig().codeExecution.enabled).toBe(true);
  });

  it('is disabled for "false"', () => {
    process.env.CODE_EXECUTION_ENABLED = 'false';

    expect(toolsConfig().codeExecution.enabled).toBe(false);
  });
});
