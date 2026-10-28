import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  default: { sourceCodeUrl: undefined as string | undefined },
}));

vi.mock('@/shared/config', () => mockConfig);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./OnboardingShowcase', () => ({
  OnboardingShowcase: () => null,
}));

import OnboardingLayout from './OnboardingLayout';

afterEach(cleanup);

describe('OnboardingLayout source code link', () => {
  it('links to the configured source code', () => {
    mockConfig.default.sourceCodeUrl = 'https://example.test/amtski';

    render(<OnboardingLayout title="Login" />);

    expect(
      screen
        .getByRole('link', { name: 'onboardingLayout.sourceCode' })
        .getAttribute('href'),
    ).toBe('https://example.test/amtski');
  });

  it('shows no source code link when none is configured', () => {
    mockConfig.default.sourceCodeUrl = undefined;

    render(<OnboardingLayout title="Login" />);

    expect(
      screen.queryByRole('link', { name: 'onboardingLayout.sourceCode' }),
    ).toBeNull();
  });
});
