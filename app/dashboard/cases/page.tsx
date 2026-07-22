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

export default async function CasesListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  const statusFilter = searchParams.status;

  let query = supabase
    .from("cases")
    .select("id, case_number, status, case_type, total_debt, created_at, needs_review, clients(full_name)")
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: cases } = await query;

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl font-semibold text-ink">Akten</h1>
        <Link
          href="/dashboard/cases/new"
          className="bg-ink text-paper text-sm px-4 py-2 rounded-sm hover:bg-ink/90 transition-colors"
        >
          + Neue Akte
        </Link>
      </div>
      <p className="text-sm text-ash mb-6">Alle Insolvenzverfahren der Kanzlei</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        <FilterPill label="Alle" href="/dashboard/cases" active={!statusFilter} />
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <FilterPill
            key={key}
            label={label}
            href={`/dashboard/cases?status=${key}`}
            active={statusFilter === key}
          />
        ))}
      </div>

      <div className="bg-white border border-ink/10 rounded-sm divide-y divide-ink/10">
        <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-ash uppercase tracking-wide">
          <div className="col-span-2">Aktenzeichen</div>
          <div className="col-span-3">Mandant</div>
          <div className="col-span-2">Verfahrensart</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Schulden</div>
          <div className="col-span-1">Angelegt</div>
        </div>
        {cases && cases.length > 0 ? (
          cases.map((c: any) => (
            <Link
              key={c.id}
              href={`/dashboard/cases/${c.id}`}
              className="grid grid-cols-12 px-4 py-3 text-sm hover:bg-paper/60 transition-colors items-center"
            >
              <div className="col-span-2 aktenzeichen text-[10px]">
                {c.case_number ?? "—"}
                {c.needs_review && <span className="ml-1 text-brass">🤖</span>}
              </div>
              <div className="col-span-3 text-ink">{c.clients?.full_name ?? "Unbekannt"}</div>
              <div className="col-span-2 text-ash">{c.case_type}</div>
              <div className="col-span-2 text-ash">{STATUS_LABELS[c.status] ?? c.status}</div>
              <div className="col-span-2 text-ash">
                {c.total_debt ? `${Number(c.total_debt).toLocaleString("de-DE")} €` : "—"}
              </div>
              <div className="col-span-1 text-xs text-ash">
                {new Date(c.created_at).toLocaleDateString("de-DE")}
              </div>
            </Link>
          ))
        ) : (
          <div className="px-4 py-8 text-sm text-ash text-center">Keine Akten gefunden.</div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
        active ? "bg-ink text-paper border-ink" : "border-ink/15 text-ash hover:border-ink/40"
      }`}
    >
      {label}
    </Link>
  );
}
