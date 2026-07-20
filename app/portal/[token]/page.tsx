import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  intake: "Aufnahme",
  antrag_vorbereitung: "Antrag in Vorbereitung",
  antrag_eingereicht: "Antrag eingereicht",
  eroeffnet: "Verfahren eröffnet",
  plan_phase: "Planphase",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
};

const RANK_LABELS: Record<string, string> = {
  einfach: "Einfache Insolvenzforderung",
  absonderung: "Absonderungsrecht",
  nachrangig: "Nachrangige Forderung",
  "massegläubiger": "Massegläubiger",
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  gemeldet: "Angemeldet",
  anerkannt: "Anerkannt",
  bestritten: "Bestritten",
  zurueckgewiesen: "Zurückgewiesen",
};

export default async function CreditorPortalPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_creditor_portal", { p_token: params.token }).maybeSingle();
  const portalData = data as any;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl font-semibold text-ink">Gläubigerportal</h1>
          <p className="text-sm text-ash mt-1">InsolvenzFlow</p>
        </div>

        <div className="bg-white border border-ink/10 rounded-sm p-8">
          {portalData && !error ? (
            <div className="space-y-4">
              <div>
                <div className="label">Aktenzeichen</div>
                <div className="aktenzeichen text-xs">{portalData.case_number}</div>
              </div>
              <div>
                <div className="label">Gläubiger</div>
                <div className="text-sm text-ink">{portalData.creditor_name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="label">Forderungsbetrag</div>
                  <div className="font-mono text-sm text-ink">
                    {Number(portalData.claim_amount).toLocaleString("de-DE")} €
                  </div>
                </div>
                <div>
                  <div className="label">Rang</div>
                  <div className="text-sm text-ink">{RANK_LABELS[portalData.rank] ?? portalData.rank}</div>
                </div>
              </div>
              <div>
                <div className="label">Status der Forderung</div>
                <div className="text-sm text-ink">{CLAIM_STATUS_LABELS[portalData.claim_status] ?? portalData.claim_status}</div>
              </div>
              <div>
                <div className="label">Verfahrensstand</div>
                <div className="text-sm text-ink">{STATUS_LABELS[portalData.case_status] ?? portalData.case_status}</div>
              </div>
              <p className="text-xs text-ash pt-4 border-t border-ink/10">
                Bei Rückfragen wenden Sie sich bitte direkt an die zuständige Kanzlei.
              </p>
            </div>
          ) : (
            <p className="text-sm text-ash text-center py-6">
              Dieser Link ist ungültig oder abgelaufen. Bitte wenden Sie sich an die Kanzlei für einen neuen Zugang.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
