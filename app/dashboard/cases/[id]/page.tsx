import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_TEMPLATES, type DocumentTemplateKey } from "@/lib/documentTemplates";
import { EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/emailTemplates";
import StatusSelector from "@/components/StatusSelector";
import DeleteCaseButton from "@/components/DeleteCaseButton";

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
  einfach: "Einfache Forderung",
  absonderung: "Absonderungsrecht",
  nachrangig: "Nachrangig",
  "massegläubiger": "Massegläubiger",
};

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { email_template?: string; creditor_id?: string };
}) {
  const supabase = createClient();
  const caseId = params.id;

  const { data: theCase } = await supabase
    .from("cases")
    .select("*, clients(id, full_name, email, phone, address)")
    .eq("id", caseId)
    .single();

  if (!theCase) notFound();

  const [{ data: creditors }, { data: deadlines }, { data: tasks }, { data: documents }, { data: plan }] =
    await Promise.all([
      supabase.from("creditors").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("deadlines").select("*").eq("case_id", caseId).order("due_date", { ascending: true }),
      supabase.from("tasks").select("*").eq("case_id", caseId).order("due_date", { ascending: true }),
      supabase.from("documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("insolvenzplan").select("*").eq("case_id", caseId).maybeSingle(),
    ]);

  // ---------- Server Actions ----------

  async function updateStatus(formData: FormData) {
    "use server";
    const supabase = createClient();
    const status = String(formData.get("status"));
    await supabase.from("cases").update({ status, updated_at: new Date().toISOString() }).eq("id", caseId);
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function addCreditor(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("creditors").insert({
      case_id: caseId,
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      email: String(formData.get("email") ?? ""),
      claim_amount: Number(formData.get("claim_amount") ?? 0),
      rank: String(formData.get("rank") ?? "einfach"),
      reference_number: String(formData.get("reference_number") ?? ""),
    });
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function addDeadline(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("deadlines").insert({
      case_id: caseId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      due_date: String(formData.get("due_date") ?? ""),
    });
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function toggleDeadline(formData: FormData) {
    "use server";
    const supabase = createClient();
    const id = String(formData.get("id"));
    const nextStatus = String(formData.get("next_status"));
    await supabase
      .from("deadlines")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function addTask(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("tasks").insert({
      case_id: caseId,
      title: String(formData.get("title") ?? ""),
      due_date: String(formData.get("due_date") ?? "") || null,
      priority: String(formData.get("priority") ?? "normal"),
    });
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function toggleTask(formData: FormData) {
    "use server";
    const supabase = createClient();
    const id = String(formData.get("id"));
    const nextStatus = String(formData.get("next_status"));
    await supabase.from("tasks").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", id);
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function generateDocument(formData: FormData) {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const templateKey = String(formData.get("template")) as DocumentTemplateKey;
    const template = DOCUMENT_TEMPLATES[templateKey];
    if (!template) return;

    const { data: fullCase } = await supabase
      .from("cases")
      .select("*, clients(full_name, address)")
      .eq("id", caseId)
      .single();

    const content = template.generate({
      caseNumber: fullCase?.case_number ?? "",
      clientName: fullCase?.clients?.full_name ?? "",
      clientAddress: fullCase?.clients?.address ?? "",
      court: fullCase?.court ?? "",
      totalDebt: fullCase?.total_debt ?? null,
      date: new Date().toLocaleDateString("de-DE"),
    });

    await supabase.from("documents").insert({
      case_id: caseId,
      doc_type: templateKey,
      title: template.label,
      content,
      status: "entwurf",
      generated_by_ai: false,
      created_by: user?.id,
    });

    redirect(`/dashboard/cases/${caseId}`);
  }

  async function savePlan(formData: FormData) {
    "use server";
    const supabase = createClient();
    const monthly = Number(formData.get("monthly_payment") ?? 0);
    const duration = Number(formData.get("duration_months") ?? 0);
    const startDate = String(formData.get("start_date") ?? "") || null;

    const payload = {
      case_id: caseId,
      monthly_payment: monthly,
      duration_months: duration,
      total_plan_amount: monthly * duration,
      start_date: startDate,
      status: "entwurf",
    };

    if (plan) {
      await supabase.from("insolvenzplan").update(payload).eq("id", plan.id);
    } else {
      await supabase.from("insolvenzplan").insert(payload);
    }
    redirect(`/dashboard/cases/${caseId}`);
  }

  async function deleteCase(formData: FormData) {
    "use server";
    const supabase = createClient();
    const clientId = String(formData.get("client_id"));
    // Deletes the case (cascades to creditors/documents/deadlines/tasks/insolvenzplan/activity_log)
    // and the client record itself — used for DSGVO "Recht auf Löschung" requests.
    await supabase.from("clients").delete().eq("id", clientId);
    redirect("/dashboard/cases");
  }

  // ---------- Email preview (computed from searchParams, no JS needed) ----------
  const hdrs = headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const siteOrigin = host ? `${proto}://${host}` : "";

  const selectedCreditor = creditors?.find((c) => c.id === searchParams.creditor_id);
  const emailTemplateKey = searchParams.email_template as EmailTemplateKey | undefined;
  let emailPreview: { subject: string; body: string } | null = null;
  if (emailTemplateKey && EMAIL_TEMPLATES[emailTemplateKey]) {
    emailPreview = EMAIL_TEMPLATES[emailTemplateKey].generate({
      caseNumber: theCase.case_number ?? "",
      clientName: theCase.clients?.full_name ?? "",
      recipientName: selectedCreditor?.name ?? theCase.clients?.full_name ?? "",
      court: theCase.court ?? "",
      dueDate: deadlines?.find((d) => d.status === "offen")?.due_date ?? undefined,
      portalLink: selectedCreditor ? `${siteOrigin}/portal/${selectedCreditor.access_token}` : undefined,
    });
  }
  const emailRecipient = selectedCreditor?.email ?? theCase.clients?.email ?? "";
  const mailtoHref = emailPreview
    ? `mailto:${emailRecipient}?subject=${encodeURIComponent(emailPreview.subject)}&body=${encodeURIComponent(
        emailPreview.body
      )}`
    : undefined;

  // ---------- Render ----------

  return (
    <div className="p-10 max-w-4xl">
      <Link href="/dashboard/cases" className="text-xs text-ash hover:text-ink">
        ← Zurück zu allen Akten
      </Link>

      <div className="flex items-start justify-between mt-3 mb-8">
        <div>
          <div className="aktenzeichen text-xs mb-2">{theCase.case_number}</div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{theCase.clients?.full_name}</h1>
          <p className="text-sm text-ash mt-1">
            {theCase.clients?.email} {theCase.clients?.phone ? `· ${theCase.clients.phone}` : ""}
          </p>
        </div>
        <StatusSelector action={updateStatus} currentStatus={theCase.status} />
      </div>

      {/* Gläubiger */}
      <Section title="Gläubiger" count={creditors?.length ?? 0}>
        <div className="divide-y divide-ink/10 mb-4">
          {creditors && creditors.length > 0 ? (
            creditors.map((c) => (
              <div key={c.id} className="py-2.5 text-sm flex items-center justify-between">
                <div>
                  <div className="text-ink">{c.name}</div>
                  <div className="text-xs text-ash">{RANK_LABELS[c.rank] ?? c.rank}</div>
                  <Link
                    href={`/dashboard/cases/${caseId}?email_template=glaeubiger_forderungsanmeldung&creditor_id=${c.id}#email`}
                    className="text-[11px] text-oxblood underline"
                  >
                    Portal-Link / E-Mail vorbereiten
                  </Link>
                </div>
                <div className="font-mono text-sm text-ink">
                  {Number(c.claim_amount).toLocaleString("de-DE")} €
                </div>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm text-ash">Noch keine Gläubiger erfasst.</p>
          )}
        </div>
        <form action={addCreditor} className="grid grid-cols-2 gap-3">
          <input name="name" required placeholder="Name des Gläubigers" className="input col-span-2" />
          <input name="claim_amount" type="number" step="0.01" placeholder="Forderungsbetrag (€)" className="input" />
          <select name="rank" className="input" defaultValue="einfach">
            <option value="einfach">Einfache Forderung</option>
            <option value="absonderung">Absonderungsrecht</option>
            <option value="nachrangig">Nachrangig</option>
            <option value="massegläubiger">Massegläubiger</option>
          </select>
          <input name="email" type="email" placeholder="E-Mail (optional)" className="input" />
          <input name="reference_number" placeholder="Aktenzeichen Gläubiger (optional)" className="input" />
          <button type="submit" className="btn col-span-2">
            + Gläubiger hinzufügen
          </button>
        </form>
      </Section>

      {/* Fristen */}
      <Section title="Fristen" count={deadlines?.filter((d) => d.status === "offen").length ?? 0}>
        <div className="divide-y divide-ink/10 mb-4">
          {deadlines && deadlines.length > 0 ? (
            deadlines.map((d) => (
              <div key={d.id} className="py-2.5 text-sm flex items-center justify-between">
                <div>
                  <div className={d.status === "erledigt" ? "line-through text-ash" : "text-ink"}>{d.title}</div>
                  <div className="font-mono text-xs text-oxblood">{d.due_date}</div>
                </div>
                <form action={toggleDeadline}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="next_status" value={d.status === "erledigt" ? "offen" : "erledigt"} />
                  <button type="submit" className="text-xs text-ash hover:text-ink underline">
                    {d.status === "erledigt" ? "Wieder öffnen" : "Erledigt"}
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm text-ash">Keine Fristen erfasst.</p>
          )}
        </div>
        <form action={addDeadline} className="grid grid-cols-2 gap-3">
          <input name="title" required placeholder="Bezeichnung der Frist" className="input col-span-2" />
          <input name="due_date" type="date" required className="input" />
          <input name="description" placeholder="Notiz (optional)" className="input" />
          <button type="submit" className="btn col-span-2">
            + Frist hinzufügen
          </button>
        </form>
      </Section>

      {/* Aufgaben */}
      <Section title="Aufgaben" count={tasks?.filter((t) => t.status !== "erledigt").length ?? 0}>
        <div className="divide-y divide-ink/10 mb-4">
          {tasks && tasks.length > 0 ? (
            tasks.map((t) => (
              <div key={t.id} className="py-2.5 text-sm flex items-center justify-between">
                <div>
                  <div className={t.status === "erledigt" ? "line-through text-ash" : "text-ink"}>{t.title}</div>
                  <div className="text-xs text-ash">{t.due_date ?? "kein Termin"} · {t.priority}</div>
                </div>
                <form action={toggleTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="next_status" value={t.status === "erledigt" ? "offen" : "erledigt"} />
                  <button type="submit" className="text-xs text-ash hover:text-ink underline">
                    {t.status === "erledigt" ? "Wieder öffnen" : "Erledigt"}
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm text-ash">Keine Aufgaben erfasst.</p>
          )}
        </div>
        <form action={addTask} className="grid grid-cols-2 gap-3">
          <input name="title" required placeholder="Aufgabe" className="input col-span-2" />
          <input name="due_date" type="date" className="input" />
          <select name="priority" className="input" defaultValue="normal">
            <option value="niedrig">Niedrig</option>
            <option value="normal">Normal</option>
            <option value="hoch">Hoch</option>
            <option value="dringend">Dringend</option>
          </select>
          <button type="submit" className="btn col-span-2">
            + Aufgabe hinzufügen
          </button>
        </form>
      </Section>

      {/* Dokumente */}
      <Section title="Dokumente" count={documents?.length ?? 0}>
        <div className="divide-y divide-ink/10 mb-4">
          {documents && documents.length > 0 ? (
            documents.map((doc) => (
              <div key={doc.id} className="py-2.5 text-sm flex items-center justify-between">
                <div>
                  <div className="text-ink">{doc.title}</div>
                  <div className="text-xs text-ash">{new Date(doc.created_at).toLocaleDateString("de-DE")}</div>
                </div>
                <Link
                  href={`/dashboard/documents/${doc.id}`}
                  className="text-xs text-oxblood underline"
                >
                  Ansehen
                </Link>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm text-ash">Noch keine Dokumente erstellt.</p>
          )}
        </div>
        <form action={generateDocument} className="flex gap-3">
          <select name="template" className="input flex-1" required>
            <option value="">Vorlage wählen…</option>
            {Object.entries(DOCUMENT_TEMPLATES).map(([key, t]) => (
              <option key={key} value={key}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn">
            Dokument erstellen
          </button>
        </form>
      </Section>

      {/* E-Mail Vorlagen */}
      <Section title="E-Mail" count={0}>
        <form method="get" id="email" className="grid grid-cols-2 gap-3 mb-5">
          <select name="email_template" defaultValue={searchParams.email_template ?? ""} className="input">
            <option value="">Vorlage wählen…</option>
            {Object.entries(EMAIL_TEMPLATES).map(([key, t]) => (
              <option key={key} value={key}>
                {t.label}
              </option>
            ))}
          </select>
          <select name="creditor_id" defaultValue={searchParams.creditor_id ?? ""} className="input">
            <option value="">Empfänger: Mandant ({theCase.clients?.full_name})</option>
            {creditors?.map((c) => (
              <option key={c.id} value={c.id}>
                Empfänger: {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn col-span-2">
            Vorschau erstellen
          </button>
        </form>

        {emailPreview ? (
          <div className="border border-ink/10 rounded-sm p-4 bg-paper/50">
            <div className="text-xs text-ash mb-1">An: {emailRecipient || "[keine E-Mail hinterlegt]"}</div>
            <div className="text-sm font-medium text-ink mb-3">{emailPreview.subject}</div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-ink mb-4">{emailPreview.body}</pre>
            {mailtoHref && (
              <a href={mailtoHref} className="btn inline-block">
                In E-Mail-Programm öffnen
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-ash">Wählen Sie eine Vorlage, um eine Vorschau zu erstellen.</p>
        )}
      </Section>


      <Section title="Insolvenzplan" count={plan ? 1 : 0}>
        <form action={savePlan} className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Monatliche Rate (€)</label>
            <input
              name="monthly_payment"
              type="number"
              step="0.01"
              defaultValue={plan?.monthly_payment ?? ""}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Laufzeit (Monate)</label>
            <input
              name="duration_months"
              type="number"
              defaultValue={plan?.duration_months ?? ""}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Beginn</label>
            <input name="start_date" type="date" defaultValue={plan?.start_date ?? ""} className="input w-full" />
          </div>
          <button type="submit" className="btn col-span-3">
            Plan speichern
          </button>
        </form>
        {plan?.total_plan_amount && (
          <p className="text-sm text-ash mt-3">
            Gesamtsumme des Plans:{" "}
            <span className="font-mono text-ink">{Number(plan.total_plan_amount).toLocaleString("de-DE")} €</span>
          </p>
        )}
      </Section>

      {/* DSGVO: Recht auf Löschung */}
      <Section title="Datenschutz" count={0}>
        <p className="text-sm text-ash mb-3">
          Löscht den Mandanten, die Akte und alle zugehörigen Daten (Gläubiger, Fristen, Aufgaben, Dokumente,
          Insolvenzplan) unwiderruflich. Nutzen Sie dies zur Erfüllung von DSGVO-Löschanfragen (Art. 17 DSGVO).
        </p>
        <DeleteCaseButton action={deleteCase} clientId={theCase.client_id} />
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink/10 rounded-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-ash">{count}</span>
      </div>
      {children}
    </div>
  );
}
