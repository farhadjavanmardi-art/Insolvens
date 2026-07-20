type EmailData = {
  caseNumber: string;
  clientName: string;
  recipientName: string;
  court: string;
  dueDate?: string;
  portalLink?: string;
};

export const EMAIL_TEMPLATES: Record<
  string,
  { label: string; generate: (d: EmailData) => { subject: string; body: string } }
> = {
  glaeubiger_forderungsanmeldung: {
    label: "An Gläubiger: Bitte um Forderungsanmeldung",
    generate: (d) => ({
      subject: `Insolvenzverfahren ${d.clientName} – Az. ${d.caseNumber} – Forderungsanmeldung`,
      body: `Sehr geehrte Damen und Herren,

in der Insolvenzsache ${d.clientName} (Az. ${d.caseNumber}) bitten wir Sie, Ihre Forderung
mit den entsprechenden Nachweisen bei uns anzumelden.

${d.portalLink ? `Den aktuellen Stand Ihrer Forderung können Sie jederzeit hier einsehen:\n${d.portalLink}\n` : ""}
Mit freundlichen Grüßen
[Kanzleiname]`,
    }),
  },
  mandant_terminbestaetigung: {
    label: "An Mandant: Terminbestätigung",
    generate: (d) => ({
      subject: `Terminbestätigung – Az. ${d.caseNumber}`,
      body: `Sehr geehrte(r) ${d.recipientName || d.clientName},

hiermit bestätigen wir Ihren Termin${d.dueDate ? ` am ${d.dueDate}` : ""} in der Insolvenzsache
mit dem Aktenzeichen ${d.caseNumber}.

Bitte bringen Sie alle relevanten Unterlagen (Einkommensnachweise, Forderungsübersicht) mit.

Mit freundlichen Grüßen
[Kanzleiname]`,
    }),
  },
  glaeubiger_fristerinnerung: {
    label: "An Gläubiger: Erinnerung Fristablauf",
    generate: (d) => ({
      subject: `Erinnerung: Fristablauf – Az. ${d.caseNumber}`,
      body: `Sehr geehrte Damen und Herren,

wir möchten Sie darauf hinweisen, dass in der Insolvenzsache ${d.clientName} (Az. ${d.caseNumber})
in Kürze${d.dueDate ? ` am ${d.dueDate}` : ""} eine Frist abläuft.

Bitte reichen Sie etwaige ausstehende Unterlagen rechtzeitig ein.

Mit freundlichen Grüßen
[Kanzleiname]`,
    }),
  },
  mandant_statusupdate: {
    label: "An Mandant: Statusupdate zum Verfahren",
    generate: (d) => ({
      subject: `Statusupdate – Az. ${d.caseNumber}`,
      body: `Sehr geehrte(r) ${d.recipientName || d.clientName},

wir möchten Sie über den aktuellen Stand Ihres Insolvenzverfahrens (Az. ${d.caseNumber})
informieren: [Status ergänzen].

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
[Kanzleiname]`,
    }),
  },
};

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
