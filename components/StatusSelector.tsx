"use client";

const STATUS_LABELS: Record<string, string> = {
  intake: "Aufnahme",
  antrag_vorbereitung: "Antrag in Vorbereitung",
  antrag_eingereicht: "Antrag eingereicht",
  eroeffnet: "Verfahren eröffnet",
  plan_phase: "Planphase",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
};

export default function StatusSelector({
  action,
  currentStatus,
}: {
  action: (formData: FormData) => void;
  currentStatus: string;
}) {
  return (
    <form action={action}>
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border border-ink/15 rounded-sm px-3 py-2 text-sm bg-white"
      >
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
