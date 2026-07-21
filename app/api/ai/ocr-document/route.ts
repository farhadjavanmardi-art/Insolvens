import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFirmAISettings } from "@/lib/ai/firmSettings";
import { ocrExtractAndClassify } from "@/lib/ai/providers";

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

  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const caseId = String(formData.get("case_id") ?? "");
  if (!image) return NextResponse.json({ error: "Kein Bild erhalten." }, { status: 400 });
  if (!caseId) return NextResponse.json({ error: "Keine Akte angegeben." }, { status: 400 });

  try {
    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const result = await ocrExtractAndClassify(settings.provider, settings.apiKey, base64, image.type || "image/jpeg");

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        case_id: caseId,
        doc_type: result.category,
        title: result.title,
        content: result.extractedText,
        status: "entwurf",
        generated_by_ai: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !doc) throw new Error(error?.message ?? "Speichern fehlgeschlagen.");

    return NextResponse.json({ documentId: doc.id, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
}
