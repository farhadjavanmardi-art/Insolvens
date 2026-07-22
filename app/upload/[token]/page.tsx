"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CaseUploadPage({ params }: { params: { token: string } }) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function handleSubmit() {
    if (!file) {
      setError("Bitte ein Foto auswählen.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const base64 = await blobToBase64(file);
      const { error: rpcError } = await supabase.rpc("submit_case_document", {
        p_case_token: params.token,
        p_image_base64: base64,
        p_mime_type: file.type || "image/jpeg",
      });
      if (rpcError) throw new Error(rpcError.message);
      setDone(true);
      setFile(null);
    } catch (err: any) {
      setError(err.message || "Übermittlung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white border border-ink/10 rounded-sm p-8">
        <h1 className="font-serif text-xl font-semibold text-ink mb-2">Unterlagen einreichen</h1>
        <p className="text-sm text-ash mb-6">
          Laden Sie ein Foto eines Dokuments hoch (z. B. Rechnung, Kontoauszug, Schreiben). Es wird automatisch
          gelesen und Ihrer Akte hinzugefügt.
        </p>

        {done ? (
          <div className="text-sm text-moss">
            ✓ Dokument wurde übermittelt und wird verarbeitet.
            <button
              type="button"
              onClick={() => setDone(false)}
              className="block mt-3 text-oxblood underline text-xs"
            >
              Weiteres Dokument einreichen
            </button>
          </div>
        ) : (
          <>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm mb-4"
            />
            {error && <p className="text-sm text-oxblood mb-3">{error}</p>}
            <button type="button" disabled={submitting} onClick={handleSubmit} className="btn disabled:opacity-50">
              {submitting ? "Wird gesendet…" : "Einreichen"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
