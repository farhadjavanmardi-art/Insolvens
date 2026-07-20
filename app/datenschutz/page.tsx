export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-16">
      <div className="max-w-2xl mx-auto bg-white border border-ink/10 rounded-sm p-10">
        <h1 className="font-serif text-2xl font-semibold text-ink mb-2">Datenschutzerklärung</h1>
        <p className="text-xs text-oxblood border border-oxblood/30 bg-oxblood/5 rounded-sm px-3 py-2 mb-8">
          Hinweis: Dies ist eine Vorlage und ersetzt keine rechtliche Prüfung. Bitte vor produktivem Einsatz
          von einem Rechtsanwalt / Datenschutzbeauftragten prüfen und an die tatsächliche Kanzlei anpassen.
        </p>

        <div className="space-y-6 text-sm text-ink/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-ink mb-1">1. Verantwortlicher</h2>
            <p>[Name der Kanzlei, Anschrift, Kontaktdaten einfügen]</p>
          </section>

          <section>
            <h2 className="font-semibold text-ink mb-1">2. Verarbeitete Daten</h2>
            <p>
              Diese Software verarbeitet Mandantendaten (Name, Kontaktdaten, Anschrift), Angaben zu
              Insolvenzverfahren, Gläubigerdaten sowie interne Vermerke und Fristen der Kanzlei zum Zweck der
              Mandatsbearbeitung im Insolvenzrecht.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink mb-1">3. Rechtsgrundlage</h2>
            <p>
              Die Verarbeitung erfolgt zur Erfüllung des Mandatsverhältnisses (Art. 6 Abs. 1 lit. b DSGVO) sowie
              zur Wahrung berufsrechtlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink mb-1">4. Hosting / Auftragsverarbeitung</h2>
            <p>
              Daten werden bei Supabase (Region Frankfurt, eu-central-1) gehostet. Ein
              Auftragsverarbeitungsvertrag (AVV) mit dem Hosting-Anbieter ist abzuschließen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink mb-1">5. Speicherdauer</h2>
            <p>
              Daten werden gemäß den berufsrechtlichen Aufbewahrungsfristen gespeichert und anschließend gelöscht.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink mb-1">6. Betroffenenrechte</h2>
            <p>
              Mandanten und Gläubiger haben das Recht auf Auskunft, Berichtigung, Löschung (Art. 17 DSGVO),
              Einschränkung der Verarbeitung sowie Datenübertragbarkeit. Löschanfragen können über die
              Kanzlei gestellt werden.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink mb-1">7. Kontakt Datenschutzbeauftragte(r)</h2>
            <p>[Falls vorhanden: Name und Kontaktdaten einfügen]</p>
          </section>
        </div>
      </div>
    </main>
  );
}
