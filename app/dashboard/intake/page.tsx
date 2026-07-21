import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  eingegangen: "Neu eingegangen",
  freigegeben: "Freigegeben",
  abgelehnt: "Abgelehnt",
};

export default async function IntakeListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user!.id).single();

  const { data: submissions } = await supabase
    .from("intake_submissions")
    .select("id, full_name, case_type, status, created_at")
    .order("created_at", { ascending: false });

  const { data: firm } = await supabase.from("firms").select("intake_token, name").eq("id", profile?.firm_id).single();

  const hdrs = headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const siteOrigin = host ? `${proto}://${host}` : "";

  return (
    <div className="p-10">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-1">Neue Anfragen</h1>
      <p className="text-sm text-ash mb-6">Selbstauskünfte potenzieller Mandanten</p>

      {firm && (
        <div className="bg-white border border-ink/10 rounded-sm p-4 mb-6">
          <div className="text-xs text-ash mb-1">Ihr persönlicher Aufnahme-Link (teilen Sie ihn mit Interessenten):</div>
          <code className="text-xs text-oxblood break-all">{`${siteOrigin}/intake/${firm.intake_token}`}</code>
        </div>
      )}

      <div className="bg-white border border-ink/10 rounded-sm divide-y divide-ink/10">
        {submissions && submissions.length > 0 ? (
          submissions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/intake/${s.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-paper/60 transition-colors"
            >
              <div>
                <div className="text-ink">{s.full_name}</div>
                <div className="text-xs text-ash">{s.case_type}</div>
              </div>
              <div className="text-xs text-ash">{STATUS_LABELS[s.status] ?? s.status}</div>
            </Link>
          ))
        ) : (
          <div className="px-4 py-8 text-sm text-ash text-center">Noch keine Anfragen eingegangen.</div>
        )}
      </div>
    </div>
  );
}
