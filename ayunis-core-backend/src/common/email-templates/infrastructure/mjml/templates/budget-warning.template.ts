import type { MJMLParseResults } from 'mjml-core';

import type { BudgetWarningTemplateContent } from 'src/common/email-templates/domain/email-template.entity';
import {
  buildBudgetWarningMessage,
  type BudgetWarningMessage,
} from './budget-warning.messages';
import { cta, escapeText, h1, p, renderLayout } from './_layout';
import { renderMjml } from './render-mjml';

function normalizeInlineText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function messageFor(
  template: BudgetWarningTemplateContent,
): BudgetWarningMessage {
  const targetName = normalizeInlineText(template.targetName);
  return buildBudgetWarningMessage({
    scope: template.scope,
    threshold: Number(template.threshold),
    targetName: { text: targetName, html: escapeText(targetName) },
    settingsUrl: template.settingsUrl,
  });
}

function greeting(recipientName: string | null): {
  text: string;
  html: string;
} {
  const normalized = recipientName ? normalizeInlineText(recipientName) : '';
  if (!normalized) {
    return { text: 'Hallo,', html: 'Hallo,' };
  }
  return {
    text: `Hallo ${normalized},`,
    html: `Hallo ${escapeText(normalized)},`,
  };
}

export function budgetWarningSubject(
  template: BudgetWarningTemplateContent,
): string {
  return messageFor(template).subject;
}

export function budgetWarningText(
  template: BudgetWarningTemplateContent,
): string {
  const message = messageFor(template);
  const greet = greeting(template.recipientName);

  return [
    `${normalizeInlineText(template.productName)} – ${message.headline}`,
    '',
    greet.text,
    '',
    ...message.paragraphs.flatMap((paragraph) => [paragraph.text, '']),
    `${message.settingsLinkLabel}: ${template.settingsUrl}`,
    '',
  ].join('\n');
}

export function budgetWarningHtml(
  template: BudgetWarningTemplateContent,
): Promise<MJMLParseResults> {
  const message = messageFor(template);
  const greet = greeting(template.recipientName);

  const bodyMjml = [
    h1(message.headline),
    p(greet.html),
    ...message.paragraphs.map((paragraph) => p(paragraph.html)),
    cta(message.ctaLabel, template.settingsUrl),
  ].join('\n');

  return renderMjml(
    renderLayout({
      title: `${message.headline} · ${normalizeInlineText(template.productName)}`,
      preheader: message.preheader,
      bodyMjml,
    }),
  );
}
