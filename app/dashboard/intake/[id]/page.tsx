import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFirmAISettings } from "@/lib/ai/firmSettings";
import { transcribeAudioOpenAI, summarizeIntake, draftIntakeReply } from "@/lib/ai/providers";
import { sendEmailViaResend } from "@/lib/email/resend";
import ApproveIntakeButton from "@/components/ApproveIntakeButton";

const KIND_LABELS: Record<string, string> = {
  privatperson: "Privatperson",
  behoerde: "Behörde / Institution",
  sonstiges: "Sonstiges",
};

export default async function IntakeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: submission } = await supabase.from("intake_submissions").select("*").eq("id", params.id).single();
  if (!submission) notFound();

  async function transcribeAndAnalyze() {
    "use server";
    const supabase = createClient();
    const settings = await getFirmAISettings();
    if (!settings) throw new Error("KI ist nicht konfiguriert. Bitte unter Einstellungen einrichten.");
    if (!submission!.voice_audio_base64) throw new Error("Keine Sprachnotiz vorhanden.");
    if (settings.provider !== "openai") throw new Error("Transkription erfordert aktuell OpenAI.");

    const audioBuffer = Buffer.from(submission!.voice_audio_base64, "base64");
    const blob = new Blob([audioBuffer], { type: submission!.voice_mime_type ?? "audio/webm" });
    const transcript = await transcribeAudioOpenAI(settings.apiKey, blob, "note.webm");
    const summary = await summarizeIntake(settings.provider, settings.apiKey, transcript);

    await supabase
      .from("intake_submissions")
      .update({ voice_transcript: transcript, ai_summary: summary })
      .eq("id", params.id);

    redirect(`/dashboard/intake/${params.id}`);
  }

  async function approveAndRespond() {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user.id).single();
    if (!profile) throw new Error("Profil nicht gefunden.");

    const { data: sub } = await supabase.from("intake_submissions").select("*").eq("id", params.id).single();
    if (!sub) throw new Error("Anfrage nicht gefunden.");

    // 1) Create client + case from the submission
    const { data: client } = await supabase
      .from("clients")
      .insert({
        full_name: sub.full_name,
        email: sub.email,
        phone: sub.phone,
        address: sub.address,
        firm_id: profile.firm_id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (!client) throw new Error("Mandant konnte nicht angelegt werden.");

    const caseNumber = `IF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalDebt = (sub.creditors as any[]).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const { data: newCase } = await supabase
      .from("cases")
      .insert({
        case_number: caseNumber,
        client_id: client.id,
        case_type: sub.case_type,
        status: "intake",
        total_debt: totalDebt || null,
        notes: sub.notes,
        responsible_lawyer: user.id,
        firm_id: profile.firm_id,
      })
      .select("id")
      .single();
    if (!newCase) throw new Error("Akte konnte nicht angelegt werden.");

    // 2) Copy creditors
    const creditorRows = (sub.creditors as any[])
      .filter((c) => c.name)
      .map((c) => ({
        case_id: newCase.id,
        name: c.name,
        claim_amount: Number(c.amount) || 0,
        creditor_kind: c.kind ?? "privatperson",
      }));
    if (creditorRows.length > 0) await supabase.from("creditors").insert(creditorRows);

    // 3) Draft + send the automated reply (only now, after explicit lawyer approval)
    let replySent = false;
    const aiSettings = await getFirmAISettings();
    if (aiSettings) {
      try {
        const draft = await draftIntakeReply(
          aiSettings.provider,
          aiSettings.apiKey,
          sub.full_name,
          sub.voice_transcript || sub.notes || "",
          caseNumber
        );

        const { data: emailSettings } = await supabase
          .from("firm_email_settings")
          .select("resend_api_key, from_email, from_name")
          .eq("firm_id", profile.firm_id)
          .maybeSingle();

        if (emailSettings && sub.email) {
          const from = emailSettings.from_name
            ? `${emailSettings.from_name} <${emailSettings.from_email}>`
            : emailSettings.from_email;
          const result = await sendEmailViaResend({
            apiKey: emailSettings.resend_api_key,
            from,
            to: sub.email,
            subject: draft.subject,
            text: draft.body,
          });
          replySent = result.ok;
        }
      } catch {
        // Reply drafting/sending is best-effort; approval + case creation must not fail because of it.
        replySent = false;
      }
    }

    await supabase
      .from("intake_submissions")
      .update({
        status: "freigegeben",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        created_case_id: newCase.id,
        reply_sent: replySent,
      })
      .eq("id", params.id);

    redirect(`/dashboard/cases/${newCase.id}`);
  }

  async function reject() {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("intake_submissions")
      .update({ status: "abgelehnt", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", params.id);
    redirect("/dashboard/intake");
  }

  const audioSrc = submission.voice_audio_base64
    ? `data:${submission.voice_mime_type ?? "audio/webm"};base64,${submission.voice_audio_base64}`
    : null;

  return (
    <div className="p-10 max-w-3xl">
      <Link href="/dashboard/intake" className="text-xs text-ash hover:text-ink">
        ← Zurück zu Anfragen
      </Link>

      <h1 className="font-serif text-2xl font-semibold text-ink mt-3 mb-1">{submission.full_name}</h1>
      <p className="text-sm text-ash mb-8">{submission.case_type} · {submission.email} · {submission.phone}</p>

      <div className="bg-white border border-ink/10 rounded-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-3">Gläubiger (Angaben des Mandanten)</h2>
        {(submission.creditors as any[])?.length > 0 ? (
          <div className="divide-y divide-ink/10">
            {(submission.creditors as any[]).map((c, i) => (
              <div key={i} className="py-2 text-sm flex justify-between">
                <div>
                  {c.name} <span className="text-xs text-ash">({KIND_LABELS[c.kind] ?? c.kind})</span>
                </div>
                <div className="font-mono">{Number(c.amount).toLocaleString("de-DE")} €</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ash">Keine Gläubiger angegeben.</p>
        )}
        {submission.notes && (
          <div className="mt-4 pt-4 border-t border-ink/10">
            <div className="label">Schriftliche Notizen</div>
            <p className="text-sm text-ink">{submission.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-ink/10 rounded-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-3">Sprachnotiz</h2>
        {audioSrc ? (
          <>
            <audio controls src={audioSrc} className="w-full mb-4" />
            {submission.voice_transcript ? (
              <>
                <div className="label">Transkript</div>
                <p className="text-sm text-ink mb-4 whitespace-pre-wrap">{submission.voice_transcript}</p>
                <div className="label">KI-Zusammenfassung</div>
                <p className="text-sm text-ink whitespace-pre-wrap">{submission.ai_summary}</p>
              </>
            ) : (
              <form action={transcribeAndAnalyze}>
                <button type="submit" className="btn text-xs">
                  Transkribieren &amp; analysieren (KI)
                </button>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-ash">Keine Sprachnotiz übermittelt.</p>
        )}
      </div>

      {submission.status === "eingegangen" ? (
        <div className="bg-white border border-ink/10 rounded-sm p-6">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-3">Freigabe</h2>
          <p className="text-xs text-ash mb-4">
            Nach Freigabe wird automatisch eine Akte angelegt und — sofern E-Mail-Versand konfiguriert ist — eine
            Eingangsbestätigung an den/die Mandant/in gesendet. Dies geschieht erst nach Ihrer ausdrücklichen
            Bestätigung unten.
          </p>
          <div className="flex gap-3">
            <ApproveIntakeButton action={approveAndRespond} />
            <form action={reject}>
              <button type="submit" className="text-sm px-4 py-2 rounded-sm border border-ink/15 text-ash hover:border-ink/40">
                Ablehnen
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-ink/10 rounded-sm p-6">
          <p className="text-sm text-ink">
            Status: <strong>{submission.status}</strong>
            {submission.status === "freigegeben" && submission.created_case_id && (
              <>
                {" "}
                ·{" "}
                <Link href={`/dashboard/cases/${submission.created_case_id}`} className="text-oxblood underline">
                  Zur Akte
                </Link>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
