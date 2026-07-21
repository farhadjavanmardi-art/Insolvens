"use client";

import { useState } from "react";

export default function ApproveIntakeButton({ action }: { action: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <form action={action}>
      <label className="flex items-start gap-2 text-xs text-ash mb-3">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
        <span>Ich habe die Angaben geprüft und gebe die Anlage der Akte sowie den Versand der Antwort frei.</span>
      </label>
      <button
        type="submit"
        disabled={!checked}
        className="text-sm px-4 py-2 rounded-sm bg-ink text-paper hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Freigeben &amp; Akte anlegen
      </button>
    </form>
  );
}
