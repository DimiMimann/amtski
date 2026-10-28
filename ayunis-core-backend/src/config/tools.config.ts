import { registerAs } from '@nestjs/config';
import { parseBooleanWithDefault } from './features.config';

export interface ToolsConfig {
  sourceGetText: {
    maxLines: number;
    maxChars: number;
  };
  codeExecution: {
    enabled: boolean;
  };
}

const parseIntWithDefault = (
  value: string | undefined,
  defaultValue: number,
): number => {
  const parsed = parseInt(value || String(defaultValue), 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export default registerAs('tools', (): ToolsConfig => ({
  sourceGetText: {
    maxLines: parseIntWithDefault(process.env.SOURCE_GET_TEXT_MAX_LINES, 200),
    maxChars: parseIntWithDefault(process.env.SOURCE_GET_TEXT_MAX_CHARS, 5000),
  },
  codeExecution: {
    enabled: parseBooleanWithDefault(process.env.CODE_EXECUTION_ENABLED, true),
  },
}));
