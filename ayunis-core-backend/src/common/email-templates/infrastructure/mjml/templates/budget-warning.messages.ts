import { BudgetWarningScope } from 'src/common/email-templates/domain/value-objects/budget-warning-scope.enum';

// Name variants: `text` is the raw (normalized) name for the plain-text
// email, `html` is the already-escaped variant for the MJML body.
export interface BudgetWarningName {
  text: string;
  html: string;
}

export interface BudgetWarningParagraph {
  text: string;
  html: string;
}

export interface BudgetWarningMessage {
  subject: string;
  headline: string;
  preheader: string;
  ctaLabel: string;
  settingsLinkLabel: string;
  paragraphs: BudgetWarningParagraph[];
}

export interface BudgetWarningMessageParams {
  scope: BudgetWarningScope;
  threshold: number;
  targetName: BudgetWarningName;
  settingsUrl: string;
}

function settingsLink(settingsUrl: string, label: string): string {
  return `<a href="${settingsUrl}">${label}</a>`;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported budget warning scope: ${String(value)}`);
}

export function buildBudgetWarningMessage(
  params: BudgetWarningMessageParams,
): BudgetWarningMessage {
  switch (params.scope) {
    case BudgetWarningScope.ORG:
      return orgMessage(params.threshold, params.settingsUrl);
    case BudgetWarningScope.USER:
      return userMessage(
        params.threshold,
        params.targetName,
        params.settingsUrl,
      );
    case BudgetWarningScope.TEAM:
      return teamMessage(
        params.threshold,
        params.targetName,
        params.settingsUrl,
      );
    default:
      return assertNever(params.scope);
  }
}

function orgMessage(
  threshold: number,
  settingsUrl: string,
): BudgetWarningMessage {
  if (threshold >= 100) {
    return orgExhaustedMessage(settingsUrl);
  }
  if (threshold >= 80) {
    return orgWarning80Message(threshold, settingsUrl);
  }
  return orgWarning50Message(threshold, settingsUrl);
}

function orgWarning50Message(
  threshold: number,
  settingsUrl: string,
): BudgetWarningMessage {
  return {
    subject: `Budgetwarnung: ${threshold} % Ihres Organisationsbudgets erreicht`,
    headline: 'Budgetwarnung',
    preheader: `Mindestens ${threshold} % Ihres Organisationsbudgets sind aufgebraucht.`,
    ctaLabel: 'Budget-Einstellungen öffnen',
    settingsLinkLabel: 'Budget-Einstellungen',
    paragraphs: [
      {
        text: `Ihr Team nutzt AmtsKI bereits aktiv – mindestens ${threshold} % Ihres Organisationsbudgets für diesen Zeitraum sind aufgebraucht. Ein gutes Zeichen dafür, dass KI in Ihrer Organisation ankommt.`,
        html: `Ihr Team nutzt AmtsKI bereits aktiv – mindestens <strong>${threshold} %</strong> Ihres Organisationsbudgets für diesen Zeitraum sind aufgebraucht. Ein gutes Zeichen dafür, dass KI in Ihrer Organisation ankommt.`,
      },
      {
        text: 'In den Budget-Einstellungen sehen Sie jederzeit den aktuellen Verbrauch und wie er sich entwickelt.',
        html: `In den ${settingsLink(settingsUrl, 'Budget-Einstellungen')} sehen Sie jederzeit den aktuellen Verbrauch und wie er sich entwickelt.`,
      },
    ],
  };
}

function orgWarning80Message(
  threshold: number,
  settingsUrl: string,
): BudgetWarningMessage {
  return {
    subject: `Budgetwarnung: ${threshold} % Ihres Organisationsbudgets erreicht`,
    headline: 'Budgetwarnung',
    preheader: `Mindestens ${threshold} % Ihres Organisationsbudgets sind aufgebraucht.`,
    ctaLabel: 'Budget-Einstellungen öffnen',
    settingsLinkLabel: 'Budget-Einstellungen',
    paragraphs: [
      {
        text: `mindestens ${threshold} % Ihres Organisationsbudgets sind aufgebraucht. Damit Ihr Team ohne Einschränkung mit den leistungsstarken Modellen weiterarbeiten kann, lohnt sich jetzt ein Blick auf den Verbrauch in den Budget-Einstellungen.`,
        html: `mindestens <strong>${threshold} %</strong> Ihres Organisationsbudgets sind aufgebraucht. Damit Ihr Team ohne Einschränkung mit den leistungsstarken Modellen weiterarbeiten kann, lohnt sich jetzt ein Blick auf den Verbrauch in den ${settingsLink(settingsUrl, 'Budget-Einstellungen')}.`,
      },
      {
        text: `Sollte das Budget vollständig aufgebraucht sein, lassen wir Ihr Team nicht im Stich: Als Sicherheitsnetz stehen im Chat weiterhin kostenlose Modelle zur Verfügung, sodass die Arbeit nie ganz stillsteht. Diese sind allerdings deutlich weniger leistungsfähig und für anspruchsvolle Aufgaben nur eingeschränkt geeignet.`,
        html: `Sollte das Budget vollständig aufgebraucht sein, lassen wir Ihr Team nicht im Stich: Als Sicherheitsnetz stehen im Chat weiterhin kostenlose Modelle zur Verfügung, sodass die Arbeit nie ganz stillsteht. Diese sind allerdings deutlich weniger leistungsfähig und für anspruchsvolle Aufgaben nur eingeschränkt geeignet.`,
      },
    ],
  };
}

function orgExhaustedMessage(settingsUrl: string): BudgetWarningMessage {
  return {
    subject: 'Ihr Organisationsbudget ist vollständig aufgebraucht',
    headline: 'Budget aufgebraucht',
    preheader: 'Ihr Organisationsbudget ist vollständig aufgebraucht.',
    ctaLabel: 'Budget-Einstellungen öffnen',
    settingsLinkLabel: 'Budget-Einstellungen',
    paragraphs: [
      {
        text: 'Ihr Organisationsbudget für diesen Zeitraum ist vollständig aufgebraucht. Ihr Team steht damit aber nicht still: Als Sicherheitsnetz stehen im Chat weiterhin kostenlose Modelle zur Verfügung, sodass Ihr Team ohne Unterbrechung weiterarbeiten kann. Diese sind jedoch deutlich weniger leistungsfähig als gewohnt und für anspruchsvolle Aufgaben nur eingeschränkt geeignet.',
        html: 'Ihr <strong>Organisationsbudget</strong> für diesen Zeitraum ist vollständig aufgebraucht. Ihr Team steht damit aber nicht still: Als Sicherheitsnetz stehen im Chat weiterhin kostenlose Modelle zur Verfügung, sodass Ihr Team ohne Unterbrechung weiterarbeiten kann. Diese sind jedoch deutlich weniger leistungsfähig als gewohnt und für anspruchsvolle Aufgaben nur eingeschränkt geeignet.',
      },
      {
        text: `Alle Details finden Sie in den Budget-Einstellungen.`,
        html: `Alle Details finden Sie in den ${settingsLink(settingsUrl, 'Budget-Einstellungen')}.`,
      },
    ],
  };
}

function userMessage(
  threshold: number,
  name: BudgetWarningName,
  settingsUrl: string,
): BudgetWarningMessage {
  if (threshold >= 100) {
    return {
      subject: `Limit erreicht: ${name.text} kann nicht mehr mit allen Modellen arbeiten`,
      headline: 'Limit erreicht',
      preheader: `${name.text} hat das festgelegte Limit vollständig erreicht.`,
      ctaLabel: 'Einstellungen öffnen',
      settingsLinkLabel: 'Einstellungen',
      paragraphs: [
        {
          text: `${name.text} hat das individuell festgelegte Limit vollständig erreicht und kann AmtsKI aktuell nicht mehr mit allen Modellen nutzen.`,
          html: `<strong>${name.html}</strong> hat das individuell festgelegte Limit vollständig erreicht und kann AmtsKI aktuell nicht mehr mit allen Modellen nutzen.`,
        },
        {
          text: 'Passen Sie das Limit in den Einstellungen an, damit diese Person wieder normal weiterarbeiten kann.',
          html: `Passen Sie das Limit in den ${settingsLink(settingsUrl, 'Einstellungen')} an, damit diese Person wieder normal weiterarbeiten kann.`,
        },
      ],
    };
  }
  return {
    subject: `Limitwarnung: ${name.text} hat ${threshold} % des Limits erreicht`,
    headline: 'Limitwarnung',
    preheader: `${name.text} hat mindestens ${threshold} % des festgelegten Limits erreicht.`,
    ctaLabel: 'Einstellungen öffnen',
    settingsLinkLabel: 'Einstellungen',
    paragraphs: [
      {
        text: `${name.text} hat mindestens ${threshold} % des individuell festgelegten Limits erreicht. Sobald das Limit vollständig erreicht ist, kann diese Person AmtsKI nicht mehr mit allen Modellen nutzen, bis Sie das Limit anpassen.`,
        html: `<strong>${name.html}</strong> hat mindestens <strong>${threshold} %</strong> des individuell festgelegten Limits erreicht. Sobald das Limit vollständig erreicht ist, kann diese Person AmtsKI nicht mehr mit allen Modellen nutzen, bis Sie das Limit anpassen.`,
      },
      {
        text: 'Sie können das Limit für einzelne Nutzer jederzeit in den Einstellungen prüfen und anpassen.',
        html: `Sie können das Limit für einzelne Nutzer jederzeit in den ${settingsLink(settingsUrl, 'Einstellungen')} prüfen und anpassen.`,
      },
    ],
  };
}

function teamMessage(
  threshold: number,
  name: BudgetWarningName,
  settingsUrl: string,
): BudgetWarningMessage {
  if (threshold >= 100) {
    return {
      subject: `Limit erreicht: Das Team ${name.text} kann nicht mehr mit allen Modellen arbeiten`,
      headline: 'Limit erreicht',
      preheader: `Das Team ${name.text} hat das festgelegte Limit vollständig erreicht.`,
      ctaLabel: 'Einstellungen öffnen',
      settingsLinkLabel: 'Einstellungen',
      paragraphs: [
        {
          text: `das Team ${name.text} hat das individuell festgelegte Limit vollständig erreicht und kann AmtsKI aktuell nicht mehr mit allen Modellen nutzen.`,
          html: `das Team <strong>${name.html}</strong> hat das individuell festgelegte Limit vollständig erreicht und kann AmtsKI aktuell nicht mehr mit allen Modellen nutzen.`,
        },
        {
          text: 'Passen Sie das Limit in den Einstellungen an, damit das Team wieder normal weiterarbeiten kann.',
          html: `Passen Sie das Limit in den ${settingsLink(settingsUrl, 'Einstellungen')} an, damit das Team wieder normal weiterarbeiten kann.`,
        },
      ],
    };
  }
  return {
    subject: `Limitwarnung: Das Team ${name.text} hat ${threshold} % des Limits erreicht`,
    headline: 'Limitwarnung',
    preheader: `Das Team ${name.text} hat mindestens ${threshold} % des festgelegten Limits erreicht.`,
    ctaLabel: 'Einstellungen öffnen',
    settingsLinkLabel: 'Einstellungen',
    paragraphs: [
      {
        text: `das Team ${name.text} hat mindestens ${threshold} % des individuell festgelegten Limits erreicht. Sobald das Limit vollständig erreicht ist, können die Teammitglieder AmtsKI nicht mehr mit allen Modellen nutzen, bis Sie das Limit anpassen.`,
        html: `das Team <strong>${name.html}</strong> hat mindestens <strong>${threshold} %</strong> des individuell festgelegten Limits erreicht. Sobald das Limit vollständig erreicht ist, können die Teammitglieder AmtsKI nicht mehr mit allen Modellen nutzen, bis Sie das Limit anpassen.`,
      },
      {
        text: 'Sie können das Limit für einzelne Teams jederzeit in den Einstellungen prüfen und anpassen.',
        html: `Sie können das Limit für einzelne Teams jederzeit in den ${settingsLink(settingsUrl, 'Einstellungen')} prüfen und anpassen.`,
      },
    ],
  };
}
