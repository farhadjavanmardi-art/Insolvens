// Server-only helpers for calling cloud AI providers.
// IMPORTANT: never import this file into a "use client" component — API keys
// must only ever be read and used inside Server Actions / Route Handlers.

export type AIProvider = "openai" | "anthropic";

export type EmailDraft = { subject: string; body: string };

const EMAIL_JSON_INSTRUCTION = `Antworte AUSSCHLIESSLICH mit validem JSON in der Form:
{"subject": "...", "body": "..."}
Kein Markdown, kein Codeblock, kein zusätzlicher Text. Die E-Mail ist auf Deutsch,
professionell und im Stil einer Rechtsanwaltskanzlei für Insolvenzrecht formuliert.`;

function parseEmailJson(raw: string): EmailDraft {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return { subject: String(parsed.subject ?? ""), body: String(parsed.body ?? "") };
  } catch {
    return { subject: "Entwurf", body: cleaned };
  }
}

// ---------- OpenAI ----------

export async function transcribeAudioOpenAI(apiKey: string, file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI Transkription fehlgeschlagen: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.text as string;
}

async function chatCompleteOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI Anfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function visionCompleteOpenAI(
  apiKey: string,
  base64Image: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI Vision-Anfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------- Anthropic ----------

async function chatCompleteAnthropic(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic Anfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function visionCompleteAnthropic(
  apiKey: string,
  base64Image: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64Image } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic Vision-Anfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ---------- High-level helpers used by the API routes ----------

export async function summarizeIntake(
  provider: AIProvider,
  apiKey: string,
  transcript: string
): Promise<string> {
  const systemPrompt = `Du bist Assistent einer Insolvenzrechts-Kanzlei. Ein/e potenzielle/r Mandant/in hat eine
Sprachnotiz zu seiner/ihrer finanziellen Situation hinterlassen. Fasse die wichtigsten Fakten für den Anwalt
strukturiert und knapp auf Deutsch zusammen (z. B. Einkommenssituation, genannte Schulden/Gläubiger, Dringlichkeit,
offene Fragen). Kein JSON, einfacher Fließtext mit Stichpunkten.`;

  return provider === "openai"
    ? await chatCompleteOpenAI(apiKey, systemPrompt, transcript)
    : await chatCompleteAnthropic(apiKey, systemPrompt, transcript);
}

const DOC_CATEGORIES = ["gerichtsbeschluss", "forderungsanmeldung", "kontoauszug", "rechnung", "sonstiges"] as const;

function parseOcrJson(raw: string): { category: string; title: string; extractedText: string } {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return {
      category: DOC_CATEGORIES.includes(parsed.category) ? parsed.category : "sonstiges",
      title: String(parsed.title ?? "Gescanntes Dokument"),
      extractedText: String(parsed.extracted_text ?? cleaned),
    };
  } catch {
    return { category: "sonstiges", title: "Gescanntes Dokument", extractedText: cleaned };
  }
}

export async function ocrExtractAndClassify(
  provider: AIProvider,
  apiKey: string,
  base64Image: string,
  mimeType: string
): Promise<{ category: string; title: string; extractedText: string }> {
  const systemPrompt = `Du bist Assistent einer Insolvenzrechts-Kanzlei. Lies den Text auf dem fotografierten
Dokument vollständig und genau ab. Ordne es einer Kategorie zu: ${DOC_CATEGORIES.join(", ")}.
Antworte AUSSCHLIESSLICH mit validem JSON: {"category": "...", "title": "kurzer Titel", "extracted_text": "..."}
Kein Markdown, kein Codeblock, kein zusätzlicher Text.`;
  const userPrompt = "Bitte lies und klassifiziere dieses Dokument.";

  const raw =
    provider === "openai"
      ? await visionCompleteOpenAI(apiKey, base64Image, mimeType, systemPrompt, userPrompt)
      : await visionCompleteAnthropic(apiKey, base64Image, mimeType, systemPrompt, userPrompt);

  return parseOcrJson(raw);
}

export async function draftIntakeReply(
  provider: AIProvider,
  apiKey: string,
  clientName: string,
  transcriptOrNotes: string,
  caseNumber: string
): Promise<EmailDraft> {
  const systemPrompt = `Du bist Assistent einer Insolvenzrechts-Kanzlei. Ein/e Anwalt/Anwältin hat die
Anfrage eines/einer potenziellen Mandanten/Mandantin geprüft und freigegeben. Formuliere eine kurze,
professionelle Eingangsbestätigung auf Deutsch: Danke für die Anfrage, Bestätigung dass die Akte angelegt
wurde, Aktenzeichen nennen, nächste Schritte grob umreißen, Kontakt für Rückfragen anbieten.
${EMAIL_JSON_INSTRUCTION}`;
  const userPrompt = `Name: ${clientName}\nAktenzeichen: ${caseNumber}\nAngaben des Mandanten:\n${transcriptOrNotes || "(keine Sprachnotiz)"}`;

  const raw =
    provider === "openai"
      ? await chatCompleteOpenAI(apiKey, systemPrompt, userPrompt)
      : await chatCompleteAnthropic(apiKey, systemPrompt, userPrompt);

  return parseEmailJson(raw);
}

export async function draftEmailFromTranscript(
  provider: AIProvider,
  apiKey: string,
  transcript: string,
  context: string
): Promise<EmailDraft> {
  const systemPrompt = `Du bist Assistent einer Insolvenzrechts-Kanzlei. Formuliere aus einer
Sprachnotiz eines Anwalts eine versandfertige, professionelle E-Mail. ${EMAIL_JSON_INSTRUCTION}`;
  const userPrompt = `Kontext der Akte: ${context}\n\nTranskribierte Sprachnotiz:\n${transcript}`;

  const raw =
    provider === "openai"
      ? await chatCompleteOpenAI(apiKey, systemPrompt, userPrompt)
      : await chatCompleteAnthropic(apiKey, systemPrompt, userPrompt);

  return parseEmailJson(raw);
}

export async function draftEmailFromImage(
  provider: AIProvider,
  apiKey: string,
  base64Image: string,
  mimeType: string,
  context: string
): Promise<EmailDraft> {
  const systemPrompt = `Du bist Assistent einer Insolvenzrechts-Kanzlei. Ein Anwalt hat ein Dokument oder
eine Notiz fotografiert. Lies den Inhalt und formuliere daraus eine versandfertige, professionelle E-Mail
(z. B. an Mandant oder Gläubiger, je nach Inhalt). ${EMAIL_JSON_INSTRUCTION}`;
  const userPrompt = `Kontext der Akte: ${context}\n\nBitte lies das Bild und erstelle die E-Mail.`;

  const raw =
    provider === "openai"
      ? await visionCompleteOpenAI(apiKey, base64Image, mimeType, systemPrompt, userPrompt)
      : await visionCompleteAnthropic(apiKey, base64Image, mimeType, systemPrompt, userPrompt);

  return parseEmailJson(raw);
}
