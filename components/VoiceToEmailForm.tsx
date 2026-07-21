"use client";

import { useState } from "react";

export default function VoiceToEmailForm({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ transcript: string; subject: string; body: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("audio") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Bitte eine Audiodatei auswählen.");
      return;
    }

    const fd = new FormData();
    fd.append("audio", file);
    fd.append("case_id", caseId);

    setLoading(true);
    try {
      const res = await fetch("/api/ai/voice-to-email", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler bei der Verarbeitung.");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-ink/10 rounded-sm p-4">
      <h3 className="text-sm font-semibold text-ink mb-2">Voice-to-Email</h3>
      <p className="text-xs text-ash mb-3">
        Sprachnotiz hochladen (z. B. .m4a, .mp3, .webm) — wird transkribiert und als E-Mail-Entwurf formuliert.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input type="file" name="audio" accept="audio/*" className="text-xs" />
        <button type="submit" disabled={loading} className="btn text-xs disabled:opacity-50">
          {loading ? "Verarbeite…" : "Verarbeiten"}
        </button>
      </form>
      {error && <p className="text-sm text-oxblood mt-3">{error}</p>}
      {result && (
        <div className="mt-4 bg-paper/50 border border-ink/10 rounded-sm p-4">
          <div className="text-xs text-ash mb-2">Transkript: {result.transcript}</div>
          <div className="text-sm font-medium text-ink mb-2">{result.subject}</div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{result.body}</pre>
        </div>
      )}
    </div>
  );
}
