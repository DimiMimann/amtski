import type { MJMLParseResults } from 'mjml-core';
import type { EmailConfirmationTemplateContent } from 'src/common/email-templates/domain/email-template.entity';
import { escapeAttribute } from './_layout';
import { renderMjml } from './render-mjml';

export function emailConfirmationText(
  template: EmailConfirmationTemplateContent,
) {
  return `AmtsKI – Bitte bestätigen Sie Ihre E-Mail-Adresse

  Vielen Dank für Ihre Anmeldung! Um Ihre Registrierung abzuschließen und AmtsKI zu nutzen, bestätigen Sie bitte Ihre E-Mail-Adresse, indem Sie auf die Schaltfläche unten klicken.

  ${template.confirmationUrl}

  Dieser Bestätigungslink läuft in 24 Stunden ab. Falls Sie kein Konto bei AmtsKI erstellt haben, können Sie diese E-Mail ignorieren.
  `;
}

export function emailConfirmationHtml(
  template: EmailConfirmationTemplateContent,
): Promise<MJMLParseResults> {
  const confirmationUrl = escapeAttribute(template.confirmationUrl);

  return renderMjml(`
<mjml>
  <mj-head>
    <mj-title>E-Mail-Adresse bestätigen</mj-title>
    <mj-attributes>
      <mj-all font-family="Inter, Arial, sans-serif" />
      <mj-text font-weight="400" font-size="16px" color="#374151" line-height="1.6" />
      <mj-section background-color="#ffffff" padding="0" />
    </mj-attributes>
  </mj-head>

  <mj-body background-color="#f9fafb">
    <!-- Header -->
    <mj-section background-color="#ffffff" padding-top="32px" padding-bottom="0">
      <mj-column>
        <mj-text align="center" font-size="28px" font-weight="700" color="#1f2937" padding-bottom="8px">
          AmtsKI
        </mj-text>
        <mj-divider border-color="#e5e7eb" border-width="1px" padding="16px 0" />
      </mj-column>
    </mj-section>

    <!-- Main Content -->
    <mj-section background-color="#ffffff" padding="32px 24px">
      <mj-column>
        <mj-text font-size="24px" font-weight="600" color="#4C1D95" align="center" padding-bottom="16px">
          Bitte bestätigen Sie Ihre E-Mail-Adresse
        </mj-text>

        <mj-text align="center" color="#6b7280" padding-bottom="24px">
          Vielen Dank für Ihre Anmeldung! Um Ihre Registrierung abzuschließen und AmtsKI zu nutzen, bestätigen Sie bitte Ihre E-Mail-Adresse, indem Sie auf die Schaltfläche unten klicken.
        </mj-text>

        <mj-button
          background-color="#4C1D95"
          color="#ffffff"
          font-size="16px"
          font-weight="600"
          border-radius="8px"
          href="${confirmationUrl}"
          css-class="confirmation-button"
        >
          E-Mail-Adresse bestätigen
        </mj-button>
      </mj-column>
    </mj-section>

    <!-- Security Notice -->
    <mj-section background-color="#fef3c7" padding="20px 24px">
      <mj-column>
        <mj-text color="#92400e" font-size="14px" align="center">
          <strong>Sicherheitshinweis:</strong> Dieser Bestätigungslink läuft in 24 Stunden ab. Falls Sie kein Konto bei AmtsKI erstellt haben, können Sie diese E-Mail ignorieren.
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>
`);
}
