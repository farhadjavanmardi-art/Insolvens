type TemplateData = {
  caseNumber: string;
  clientName: string;
  clientAddress: string;
  court: string;
  totalDebt: number | null;
  date: string;
};

export const DOCUMENT_TEMPLATES: Record<string, { label: string; generate: (d: TemplateData) => string }> = {
  insolvenzantrag: {
    label: "Insolvenzantrag",
    generate: (d) => `INSOLVENZANTRAG

An das Amtsgericht ${d.court || "[Gericht eintragen]"}
– Insolvenzgericht –

Az.: ${d.caseNumber}
Datum: ${d.date}

In Sachen

${d.clientName}
${d.clientAddress || "[Anschrift eintragen]"}

– Schuldner/in –

wird hiermit beantragt,

über das Vermögen der/des Schuldner/in das Insolvenzverfahren zu eröffnen.

Begründung:

Die/der Schuldner/in ist zahlungsunfähig. Die Gesamtverbindlichkeiten belaufen sich nach
derzeitigem Kenntnisstand auf ca. ${d.totalDebt ? d.totalDebt.toLocaleString("de-DE") + " €" : "[Betrag eintragen]"}.

Ein Vermögensverzeichnis, ein Gläubiger- und Forderungsverzeichnis sowie eine Bescheinigung
über den erfolglosen außergerichtlichen Einigungsversuch werden beigefügt / nachgereicht.

Es wird beantragt, den Antrag als zulässig zu behandeln und das Verfahren zu eröffnen.

_________________________
Unterschrift Rechtsanwalt/-anwältin`,
  },
  glaeubigerverzeichnis: {
    label: "Gläubigerverzeichnis (Deckblatt)",
    generate: (d) => `GLÄUBIGERVERZEICHNIS

Az.: ${d.caseNumber}
Schuldner/in: ${d.clientName}
Datum: ${d.date}

Dieses Verzeichnis erfasst sämtliche der Kanzlei bekannten Gläubiger und deren angemeldete
Forderungen im Insolvenzverfahren der/des oben genannten Schuldner/in.

Die einzelnen Forderungen sind der beigefügten Gläubigerliste (Anlage) zu entnehmen,
gegliedert nach Rang (einfache Insolvenzforderung, Absonderungsrecht, nachrangige Forderung).

_________________________
Unterschrift Rechtsanwalt/-anwältin`,
  },
  bericht_an_gericht: {
    label: "Bericht an das Insolvenzgericht",
    generate: (d) => `BERICHT AN DAS INSOLVENZGERICHT

An das Amtsgericht ${d.court || "[Gericht eintragen]"}
– Insolvenzgericht –

Az.: ${d.caseNumber}
Datum: ${d.date}

In Sachen ${d.clientName}

wird über den aktuellen Verfahrensstand wie folgt berichtet:

1. Verfahrensstand: [ergänzen]
2. Gläubigerforderungen: [ergänzen]
3. Vermögenslage: [ergänzen]
4. Weiteres Vorgehen: [ergänzen]

_________________________
Unterschrift Rechtsanwalt/-anwältin`,
  },
  glaeubigerschreiben: {
    label: "Schreiben an Gläubiger",
    generate: (d) => `Sehr geehrte Damen und Herren,

in der Insolvenzsache ${d.clientName} (Az.: ${d.caseNumber}) teilen wir Ihnen mit,
dass über das Vermögen unserer Mandantschaft ein Insolvenzverfahren beantragt bzw.
eröffnet wurde.

Wir bitten Sie, Ihre Forderung mit den entsprechenden Nachweisen bei uns anzumelden.

Mit freundlichen Grüßen

[Kanzleiname]`,
  },
};

export type DocumentTemplateKey = keyof typeof DOCUMENT_TEMPLATES;
