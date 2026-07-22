// Supabase Edge Function: process-intake
// Triggered automatically (via DB trigger + pg_net) right after a client submits the
// public intake form. Uses the service-role key (auto-injected by Supabase, never exposed
// to the client) to do privileged work: read the firm's AI/email settings, transcribe the
// voice note, decide if anything critical is missing, and either (a) auto-create the
// client + case + creditors and send a confirmation email with a document-upload link, or
// (b) email the prospective client asking for the missing information.
//
// The resulting case is marked ai_created=true, needs_review=true so a lawyer can audit it
// afterwards — automation happens immediately, but nothing is presented as fully handled
// until a human has looked at it.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = "https://inspiring-concha-4cb28c.netlify.app"; // update if a custom domain is connected

const DOC_TYPE_LABELS: Record<string, string> = {
  regelinsolvenz: "Regelinsolvenz",
  verbraucherinsolvenz: "Verbraucherinsolvenz",
  unternehmensinsolvenz: "Unternehmensinsolvenz",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function transcribeAudio(apiKey: string, base64: string, mimeType: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
  const form = new FormData();
  form.append("file", blob, "note.webm");
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.text as string;
}

async function chatComplete(provider: string, apiKey: string, system: string, user: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } else {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }
}

function parseJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function sendEmail(resendKey: string, from: string, to: string, subject: string, text: string) {
  return await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
}

Deno.serve(async (req) => {
  try {
    const { submission_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: sub, error: subError } = await supabase
      .from("intake_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();
    if (subError || !sub) return jsonResponse({ error: "submission not found" }, 404);

    const { data: aiSettings } = await supabase
      .from("firm_ai_settings")
      .select("provider, api_key, dpa_confirmed")
      .eq("firm_id", sub.firm_id)
      .maybeSingle();

    if (!aiSettings || !aiSettings.dpa_confirmed) {
      await supabase
        .from("intake_submissions")
        .update({ processing_status: "error", error_message: "KI nicht konfiguriert oder AVV nicht bestätigt." })
        .eq("id", submission_id);
      return jsonResponse({ status: "skipped_no_ai_settings" });
    }

    const { data: emailSettings } = await supabase
      .from("firm_email_settings")
      .select("resend_api_key, from_email, from_name")
      .eq("firm_id", sub.firm_id)
      .maybeSingle();

    // 1) Transcribe voice note, if present
    let transcript = "";
    if (sub.voice_audio_base64 && aiSettings.provider === "openai") {
      transcript = await transcribeAudio(aiSettings.api_key, sub.voice_audio_base64, sub.voice_mime_type);
    }

    const combinedText = [sub.notes, transcript].filter(Boolean).join("\n\n");

    // 2) Ask the model whether anything critical is missing, and for a short case summary
    const analysisSystem = `Du bist Assistent einer Insolvenzrechts-Kanzlei. Prüfe die Angaben eines/einer
potenziellen Mandanten/in. Kritisch fehlend heißt: kein Name, keine Möglichkeit ihn/sie zu erreichen
(weder E-Mail noch Telefon), oder die Beschreibung ist so unklar, dass eine Akte nicht sinnvoll angelegt
werden kann. Fehlende Beträge bei Gläubigern sind NICHT kritisch.
Antworte AUSSCHLIESSLICH mit validem JSON:
{"complete": true|false, "missing_fields": ["..."], "summary": "kurze Zusammenfassung auf Deutsch"}`;
    const analysisUser = `Name: ${sub.full_name}\nE-Mail: ${sub.email}\nTelefon: ${sub.phone}\nAdresse: ${sub.address}
Verfahrensart: ${sub.case_type}\nGläubiger: ${JSON.stringify(sub.creditors)}\nBeschreibung:\n${combinedText || "(keine)"}`;

    const analysisRaw = await chatComplete(aiSettings.provider, aiSettings.api_key, analysisSystem, analysisUser);
    const analysis = parseJson(analysisRaw) ?? { complete: true, missing_fields: [], summary: combinedText };

    await supabase
      .from("intake_submissions")
      .update({ voice_transcript: transcript || null, ai_summary: analysis.summary ?? null })
      .eq("id", submission_id);

    const fromHeader = emailSettings
      ? emailSettings.from_name
        ? `${emailSettings.from_name} <${emailSettings.from_email}>`
        : emailSettings.from_email
      : null;

    // 3a) Missing critical info -> ask the client, don't create a case yet
    if (!analysis.complete && analysis.missing_fields?.length > 0) {
      const questionSystem = `Formuliere auf Deutsch eine kurze, freundliche E-Mail an eine(n) potenzielle(n)
Mandanten/in, die/der eine Anfrage gestellt hat. Bitte um die fehlenden Angaben (siehe Liste). Halte es kurz
und professionell. Antworte AUSSCHLIESSLICH mit JSON: {"subject": "...", "body": "..."}`;
      const questionUser = `Name: ${sub.full_name}\nFehlende Angaben: ${analysis.missing_fields.join(", ")}`;
      const draftRaw = await chatComplete(aiSettings.provider, aiSettings.api_key, questionSystem, questionUser);
      const draft = parseJson(draftRaw) ?? { subject: "Ergänzende Angaben benötigt", body: questionUser };

      if (emailSettings && sub.email && fromHeader) {
        await sendEmail(emailSettings.resend_api_key, fromHeader, sub.email, draft.subject, draft.body);
      }

      await supabase
        .from("intake_submissions")
        .update({ processing_status: "needs_client_info", follow_up_question: draft.body })
        .eq("id", submission_id);

      return jsonResponse({ status: "needs_client_info" });
    }

    // 3b) Everything looks sufficient -> auto-create client + case + creditors
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        full_name: sub.full_name,
        email: sub.email,
        phone: sub.phone,
        address: sub.address,
        firm_id: sub.firm_id,
      })
      .select("id")
      .single();
    if (clientError || !client) throw new Error(clientError?.message ?? "client insert failed");

    const caseNumber = `IF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalDebt = (sub.creditors as any[]).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        case_number: caseNumber,
        client_id: client.id,
        case_type: sub.case_type,
        status: "intake",
        total_debt: totalDebt || null,
        notes: analysis.summary ?? sub.notes,
        firm_id: sub.firm_id,
        ai_created: true,
        needs_review: true,
      })
      .select("id, client_upload_token")
      .single();
    if (caseError || !newCase) throw new Error(caseError?.message ?? "case insert failed");

    const creditorRows = (sub.creditors as any[])
      .filter((c) => c.name)
      .map((c) => ({
        case_id: newCase.id,
        name: c.name,
        claim_amount: Number(c.amount) || 0,
        creditor_kind: c.kind ?? "privatperson",
      }));
    if (creditorRows.length > 0) await supabase.from("creditors").insert(creditorRows);

    // 4) Draft + send confirmation, including the per-case document upload link
    let replySent = false;
    if (emailSettings && sub.email && fromHeader) {
      const uploadLink = `${SITE_URL}/upload/${newCase.client_upload_token}`;
      const replySystem = `Formuliere auf Deutsch eine kurze, professionelle Eingangsbestätigung einer
Insolvenzrechts-Kanzlei. Bedanke dich für die Anfrage, nenne das Aktenzeichen, erwähne, dass weitere
Unterlagen (Fotos von Dokumenten) über den beigefügten Link eingereicht werden können, und dass sich die
Kanzlei zeitnah meldet. Antworte AUSSCHLIESSLICH mit JSON: {"subject": "...", "body": "..."}`;
      const replyUser = `Name: ${sub.full_name}\nAktenzeichen: ${caseNumber}\nUpload-Link: ${uploadLink}`;
      const replyRaw = await chatComplete(aiSettings.provider, aiSettings.api_key, replySystem, replyUser);
      const reply = parseJson(replyRaw) ?? {
        subject: `Ihre Anfrage – Az. ${caseNumber}`,
        body: `Vielen Dank für Ihre Anfrage. Ihre Akte wurde unter dem Aktenzeichen ${caseNumber} angelegt. Weitere Unterlagen können Sie hier einreichen: ${uploadLink}`,
      };
      const res = await sendEmail(emailSettings.resend_api_key, fromHeader, sub.email, reply.subject, reply.body);
      replySent = res.ok;
    }

    await supabase
      .from("intake_submissions")
      .update({
        processing_status: "processed",
        status: "freigegeben",
        created_case_id: newCase.id,
        reviewed_at: new Date().toISOString(),
        reply_sent: replySent,
      })
      .eq("id", submission_id);

    return jsonResponse({ status: "processed", case_id: newCase.id });
  } catch (err: any) {
    return jsonResponse({ error: err.message ?? "unknown error" }, 500);
  }
});
