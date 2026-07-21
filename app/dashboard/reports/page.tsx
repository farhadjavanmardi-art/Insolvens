import { createClient } from "@/lib/supabase/server";
import { MonthlyCasesChart, StatusDistributionChart } from "@/components/ReportsCharts";

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function ReportsPage() {
  const supabase = createClient();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, status, created_at, updated_at, total_debt");

  const allCases = cases ?? [];

  // ---------- Monthly new cases (last 6 months) ----------
  const now = new Date();
  const months: { key: string; month: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_LABELS[d.getMonth()] });
  }
  const monthlyCounts = months.map(({ key, month }) => {
    const count = allCases.filter((c) => {
      const d = new Date(c.created_at);
      return `${d.getFullYear()}-${d.getMonth()}` === key;
    }).length;
    return { month, count };
  });

  // ---------- Status distribution ----------
  const statusCounts: Record<string, number> = {};
  for (const c of allCases) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  // ---------- KPIs ----------
  const activeCases = allCases.filter((c) => !["abgeschlossen", "abgelehnt"].includes(c.status));
  const totalActiveDebt = activeCases.reduce((sum, c) => sum + (Number(c.total_debt) || 0), 0);

  const closedCases = allCases.filter((c) => c.status === "abgeschlossen");
  const avgDurationDays =
    closedCases.length > 0
      ? Math.round(
          closedCases.reduce((sum, c) => {
            const days = (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / closedCases.length
        )
      : null;

  const decided = allCases.filter((c) => ["abgeschlossen", "abgelehnt"].includes(c.status));
  const successRate =
    decided.length > 0 ? Math.round((closedCases.length / decided.length) * 100) : null;

  return (
    <div className="p-10">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-1">Berichte</h1>
      <p className="text-sm text-ash mb-8">Kanzleiweite Auswertung aller Akten</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Kpi label="Akten gesamt" value={String(allCases.length)} />
        <Kpi label="Aktive Schuldsumme" value={`${totalActiveDebt.toLocaleString("de-DE")} €`} />
        <Kpi
          label="Ø Bearbeitungsdauer"
          value={avgDurationDays !== null ? `${avgDurationDays} Tage` : "—"}
          hint="Abgeschlossene Akten"
        />
        <Kpi
          label="Erfolgsquote"
          value={successRate !== null ? `${successRate}%` : "—"}
          hint="Abgeschlossen vs. abgelehnt"
          accent
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-ink/10 rounded-sm p-6">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-4">Neue Akten pro Monat</h2>
          <MonthlyCasesChart data={monthlyCounts} />
        </div>
        <div className="bg-white border border-ink/10 rounded-sm p-6">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-4">Verteilung nach Status</h2>
          {statusData.length > 0 ? (
            <StatusDistributionChart data={statusData} />
          ) : (
            <p className="text-sm text-ash">Noch keine Daten.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-ash mt-6">
        Hinweis: Die Bearbeitungsdauer wird aus dem letzten Statuswechsel (nicht einem separaten Abschlussdatum)
        berechnet und ist daher eine Annäherung.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-ink/10 rounded-sm p-5">
      <div className={`font-serif text-2xl font-semibold ${accent ? "text-oxblood" : "text-ink"}`}>{value}</div>
      <div className="text-xs text-ash mt-1 uppercase tracking-wide">{label}</div>
      {hint && <div className="text-[11px] text-ash/70 mt-0.5">{hint}</div>}
    </div>
  );
}
