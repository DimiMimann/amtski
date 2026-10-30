import type { MJMLParseResults } from 'mjml-core';
import type { SetInitialPasswordTemplateContent } from 'src/common/email-templates/domain/email-template.entity';
import { cta, escapeText, fineprint, h1, p, renderLayout } from './_layout';
import { renderMjml } from './render-mjml';

export function setInitialPasswordText(
  template: SetInitialPasswordTemplateContent,
): string {
  return `${template.productName} – Willkommen!

Hallo ${template.userName},

Wir haben ein Konto für Sie bei ${template.productName} angelegt. Legen Sie nur noch ein Passwort fest, um Ihr Konto zu aktivieren – danach können Sie direkt loslegen.

Konto aktivieren: ${template.resetUrl}

Der Link ist 7 Tage gültig. Sollten Sie das nicht erwartet haben, wenden Sie sich an Ihre Administration.
`;
}

export function setInitialPasswordHtml(
  template: SetInitialPasswordTemplateContent,
): Promise<MJMLParseResults> {
  const userName = escapeText(template.userName);

  const body = [
    h1(`Willkommen bei ${template.productName}!`),
    p(`Hallo ${userName},`),
    p(
      `Wir haben ein Konto für Sie bei ${template.productName} angelegt. Legen Sie nur noch ein Passwort fest, um Ihr Konto zu aktivieren – danach können Sie direkt loslegen.`,
    ),
    cta('Konto aktivieren', template.resetUrl),
    fineprint(
      'Der Link ist 7 Tage gültig. Sollten Sie das nicht erwartet haben, wenden Sie sich an Ihre Administration.',
    ),
  ].join('\n');

  return renderMjml(
    renderLayout({
      title: `Ihr Konto bei ${template.invitingCompanyName} · ${template.productName}`,
      preheader: `Wir haben ein Konto für Sie angelegt. Legen Sie jetzt Ihr Passwort fest.`,
      bodyMjml: body,
    }),
  );
}
