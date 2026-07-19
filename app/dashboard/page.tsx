import Link from "next/link";
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

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ count: openCases }, { data: upcomingDeadlines }, { count: openTasks }, { data: recentCases }] =
    await Promise.all([
      supabase
        .from("cases")
        .select("*", { count: "exact", head: true })
        .not("status", "in", "(abgeschlossen,abgelehnt)"),
      supabase
        .from("deadlines")
        .select("id, title, due_date, case_id, cases(case_number)")
        .eq("status", "offen")
        .order("due_date", { ascending: true })
        .limit(5),
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "offen"),
      supabase
        .from("cases")
        .select("id, case_number, status, total_debt, created_at, clients(full_name)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  return (
    <div className="p-10">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-1">Übersicht</h1>
      <p className="text-sm text-ash mb-8">Aktueller Stand der Kanzlei</p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Laufende Akten" value={openCases ?? 0} />
        <StatCard label="Offene Fristen" value={upcomingDeadlines?.length ?? 0} accent />
        <StatCard label="Offene Aufgaben" value={openTasks ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-semibold text-ink mb-3 uppercase tracking-wide">Nächste Fristen</h2>
          <div className="bg-white border border-ink/10 rounded-sm divide-y divide-ink/10">
            {upcomingDeadlines && upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((d: any) => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-ink">{d.title}</div>
                    <div className="text-xs text-ash">{d.cases?.case_number ?? "—"}</div>
                  </div>
                  <div className="font-mono text-xs text-oxblood">{d.due_date}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-ash text-center">Keine offenen Fristen.</div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-ink mb-3 uppercase tracking-wide">Neueste Akten</h2>
          <div className="bg-white border border-ink/10 rounded-sm divide-y divide-ink/10">
            {recentCases && recentCases.length > 0 ? (
              recentCases.map((c: any) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-ink">{c.clients?.full_name ?? "Unbekannt"}</div>
                    <div className="aktenzeichen text-[10px] mt-1">{c.case_number ?? "kein Az."}</div>
                  </div>
                  <div className="text-xs text-ash">{STATUS_LABELS[c.status] ?? c.status}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-ash text-center">
                Noch keine Akten.{" "}
                <Link href="/dashboard/cases/new" className="text-oxblood underline">
                  Erste Akte anlegen
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white border border-ink/10 rounded-sm p-5">
      <div className={`font-serif text-3xl font-semibold ${accent ? "text-oxblood" : "text-ink"}`}>{value}</div>
      <div className="text-xs text-ash mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}
