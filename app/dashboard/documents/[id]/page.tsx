import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentViewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("*, cases(case_number, id)")
    .eq("id", params.id)
    .single();

  if (!doc) notFound();

  return (
    <div className="p-10 max-w-3xl">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href={`/dashboard/cases/${doc.cases?.id}`} className="text-xs text-ash hover:text-ink">
          ← Zurück zur Akte
        </Link>
        <div className="flex gap-3">
          <span className="aktenzeichen text-[10px]">{doc.cases?.case_number}</span>
        </div>
      </div>

      <div className="bg-white border border-ink/10 rounded-sm p-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-xl font-semibold text-ink">{doc.title}</h1>
          <span className="text-xs px-2 py-1 border border-ink/15 rounded-sm text-ash uppercase">{doc.status}</span>
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{doc.content}</pre>
      </div>
    </div>
  );
}
