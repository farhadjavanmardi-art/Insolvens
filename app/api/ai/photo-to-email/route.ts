import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFirmAISettings } from "@/lib/ai/firmSettings";
import { draftEmailFromImage } from "@/lib/ai/providers";

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

  const { data: theCase } = await supabase
    .from("cases")
    .select("case_number, clients(full_name)")
    .eq("id", caseId)
    .single();

  try {
    // Image is processed in-memory only and never written to disk or a database.
    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const context = theCase
      ? `Akte ${theCase.case_number}, Mandant ${(theCase as any).clients?.full_name}`
      : "keine Akte ausgewählt";
    const draft = await draftEmailFromImage(
      settings.provider,
      settings.apiKey,
      base64,
      image.type || "image/jpeg",
      context
    );
    return NextResponse.json(draft);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
}
