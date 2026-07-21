"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_LABELS: Record<string, string> = {
  gerichtsbeschluss: "Gerichtsbeschluss",
  forderungsanmeldung: "Forderungsanmeldung",
  kontoauszug: "Kontoauszug",
  rechnung: "Rechnung",
  sonstiges: "Sonstiges",
};

export default function OcrDocumentForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ category: string; title: string; extractedText: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("image") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Bitte ein Foto des Dokuments auswählen.");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);
    fd.append("case_id", caseId);

    setLoading(true);
    try {
      const res = await fetch("/api/ai/ocr-document", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler bei der Verarbeitung.");
      setResult(data);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-ink/10 rounded-sm p-4">
      <h3 className="text-sm font-semibold text-ink mb-2">Dokument-Scan (OCR)</h3>
      <p className="text-xs text-ash mb-3">
        Foto eines Schreibens hochladen (z. B. Kontoauszug, Rechnung, Gerichtsbeschluss) — wird gelesen,
        automatisch kategorisiert und der Akte als Dokument hinzugefügt.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input type="file" name="image" accept="image/*" className="text-xs" />
        <button type="submit" disabled={loading} className="btn text-xs disabled:opacity-50">
          {loading ? "Verarbeite…" : "Scannen"}
        </button>
      </form>
      {error && <p className="text-sm text-oxblood mt-3">{error}</p>}
      {result && (
        <div className="mt-4 bg-paper/50 border border-ink/10 rounded-sm p-4">
          <div className="text-xs text-ash mb-1">Kategorie: {CATEGORY_LABELS[result.category] ?? result.category}</div>
          <div className="text-sm font-medium text-ink mb-2">{result.title}</div>
          <p className="text-xs text-ash">Als Dokument in der Akte gespeichert.</p>
        </div>
      )}
    </div>
  );
}
