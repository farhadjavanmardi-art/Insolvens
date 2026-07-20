"use client";

export default function DeleteCaseButton({
  action,
  clientId,
}: {
  action: (formData: FormData) => void;
  clientId: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Wirklich unwiderruflich löschen? Dies kann nicht rückgängig gemacht werden.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="client_id" value={clientId} />
      <button
        type="submit"
        className="text-sm px-4 py-2 rounded-sm border border-oxblood text-oxblood hover:bg-oxblood hover:text-white transition-colors"
      >
        Mandant &amp; Akte endgültig löschen
      </button>
    </form>
  );
}
