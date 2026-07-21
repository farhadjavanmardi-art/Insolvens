import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFirmAISettings } from "@/lib/ai/firmSettings";
import { transcribeAudioOpenAI, draftEmailFromTranscript } from "@/lib/ai/providers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const settings = await getFirmAISettings();
  if (!settings) {
    return NextResponse.json(
      { error: "KI-Funktionen sind nicht konfiguriert. Bitte in den Einstellungen einrichten und AVV bestätigen." },
      { status: 400 }
    );
  }
  if (settings.provider !== "openai") {
    return NextResponse.json(
      { error: "Voice-to-Email benötigt aktuell einen OpenAI-Schlüssel (für Spracherkennung)." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;
  const caseId = String(formData.get("case_id") ?? "");
  if (!audio) return NextResponse.json({ error: "Keine Audiodatei erhalten." }, { status: 400 });

  const { data: theCase } = await supabase
    .from("cases")
    .select("case_number, clients(full_name)")
    .eq("id", caseId)
    .single();

  try {
    // Audio is processed in-memory only and never written to disk or a database.
    const transcript = await transcribeAudioOpenAI(settings.apiKey, audio, audio.name || "note.webm");
    const context = theCase
      ? `Akte ${theCase.case_number}, Mandant ${(theCase as any).clients?.full_name}`
      : "keine Akte ausgewählt";
    const draft = await draftEmailFromTranscript("openai", settings.apiKey, transcript, context);
    return NextResponse.json({ transcript, ...draft });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
}
