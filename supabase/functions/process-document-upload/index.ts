// Supabase Edge Function: process-document-upload
// Triggered automatically when a client submits a follow-up document photo via their
// per-case upload link. Reads the document with vision AI, classifies it, stores the
// result in `documents` (marked reviewed=false so the lawyer sees it needs a look), and
// clears the raw image afterward (data minimization).

import { createClient } from "jsr:@supabase/supabase-js@2";

const DOC_CATEGORIES = ["gerichtsbeschluss", "forderungsanmeldung", "kontoauszug", "rechnung", "sonstiges"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function parseJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function visionExtract(provider: string, apiKey: string, base64: string, mimeType: string) {
  const system = `Lies den Text auf dem fotografierten Dokument vollständig ab. Ordne es einer Kategorie zu:
${DOC_CATEGORIES.join(", ")}. Antworte AUSSCHLIESSLICH mit JSON:
{"category": "...", "title": "kurzer Titel", "extracted_text": "..."}`;
  const userText = "Bitte lies und klassifiziere dieses Dokument.";

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI vision failed: ${res.status} ${await res.text()}`);
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
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic vision failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }
}

Deno.serve(async (req) => {
  try {
    const { upload_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: upload, error: uploadError } = await supabase
      .from("document_uploads")
      .select("*, cases(firm_id)")
      .eq("id", upload_id)
      .single();
    if (uploadError || !upload) return jsonResponse({ error: "upload not found" }, 404);

    const firmId = (upload as any).cases?.firm_id;
    const { data: aiSettings } = await supabase
      .from("firm_ai_settings")
      .select("provider, api_key, dpa_confirmed")
      .eq("firm_id", firmId)
      .maybeSingle();

    if (!aiSettings || !aiSettings.dpa_confirmed) {
      await supabase
        .from("document_uploads")
        .update({ status: "error", error_message: "KI nicht konfiguriert." })
        .eq("id", upload_id);
      return jsonResponse({ status: "skipped_no_ai_settings" });
    }

    const raw = await visionExtract(aiSettings.provider, aiSettings.api_key, upload.image_base64, upload.mime_type);
    const parsed = parseJson(raw) ?? { category: "sonstiges", title: "Gescanntes Dokument", extracted_text: raw };
    const category = DOC_CATEGORIES.includes(parsed.category) ? parsed.category : "sonstiges";

    await supabase.from("documents").insert({
      case_id: upload.case_id,
      doc_type: category,
      title: parsed.title ?? "Gescanntes Dokument",
      content: parsed.extracted_text ?? "",
      status: "entwurf",
      generated_by_ai: true,
      reviewed: false,
    });

    // Data minimization: drop the raw image once it has been processed.
    await supabase
      .from("document_uploads")
      .update({ status: "processed", image_base64: null })
      .eq("id", upload_id);

    return jsonResponse({ status: "processed" });
  } catch (err: any) {
    return jsonResponse({ error: err.message ?? "unknown error" }, 500);
  }
});
