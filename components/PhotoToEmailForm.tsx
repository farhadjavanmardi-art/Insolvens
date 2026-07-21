"use client";

import { useState } from "react";

export default function PhotoToEmailForm({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("image") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Bitte ein Foto auswählen.");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);
    fd.append("case_id", caseId);

    setLoading(true);
    try {
      const res = await fetch("/api/ai/photo-to-email", { method: "POST", body: fd });
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
      <h3 className="text-sm font-semibold text-ink mb-2">Foto-to-Email</h3>
      <p className="text-xs text-ash mb-3">
        Foto eines Dokuments oder einer Notiz hochladen — wird gelesen und als E-Mail-Entwurf formuliert.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input type="file" name="image" accept="image/*" className="text-xs" />
        <button type="submit" disabled={loading} className="btn text-xs disabled:opacity-50">
          {loading ? "Verarbeite…" : "Verarbeiten"}
        </button>
      </form>
      {error && <p className="text-sm text-oxblood mt-3">{error}</p>}
      {result && (
        <div className="mt-4 bg-paper/50 border border-ink/10 rounded-sm p-4">
          <div className="text-sm font-medium text-ink mb-2">{result.subject}</div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{result.body}</pre>
        </div>
      )}
    </div>
  );
}
