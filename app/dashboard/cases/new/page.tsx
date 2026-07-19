import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function createCase(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const caseType = String(formData.get("case_type") ?? "regelinsolvenz");
  const totalDebt = formData.get("total_debt") ? Number(formData.get("total_debt")) : null;
  const notes = String(formData.get("notes") ?? "").trim();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({ full_name: fullName, email, phone, address, created_by: user.id })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error("Mandant konnte nicht angelegt werden: " + clientError?.message);
  }

  const caseNumber = `IF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: newCase, error: caseError } = await supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      client_id: client.id,
      case_type: caseType,
      status: "intake",
      total_debt: totalDebt,
      notes,
      responsible_lawyer: user.id,
    })
    .select("id")
    .single();

  if (caseError || !newCase) {
    throw new Error("Akte konnte nicht angelegt werden: " + caseError?.message);
  }

  await supabase.from("activity_log").insert({
    case_id: newCase.id,
    actor_id: user.id,
    action: "case_created",
    details: { case_number: caseNumber },
  });

  redirect("/dashboard");
}

export default function NewCasePage() {
  return (
    <div className="p-10 max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-1">Neue Akte anlegen</h1>
      <p className="text-sm text-ash mb-8">
        Erfassen Sie die Mandanten- und Falldaten. Ein Aktenzeichen wird automatisch vergeben.
      </p>

      <form action={createCase} className="bg-white border border-ink/10 rounded-sm p-8 space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold text-ink uppercase tracking-wide mb-2">Mandant</legend>
          <Field label="Vollständiger Name" name="full_name" required placeholder="Max Mustermann" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="E-Mail" name="email" type="email" placeholder="max@beispiel.de" />
            <Field label="Telefon" name="phone" placeholder="+49 151 ..." />
          </div>
          <Field label="Anschrift" name="address" placeholder="Musterstraße 1, 70173 Stuttgart" />
        </fieldset>

        <fieldset className="space-y-4 border-t border-ink/10 pt-6">
          <legend className="text-xs font-semibold text-ink uppercase tracking-wide mb-2">Verfahren</legend>
          <div>
            <label className="block text-xs font-medium text-ash mb-1">Verfahrensart</label>
            <select
              name="case_type"
              className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oxblood/40"
              defaultValue="regelinsolvenz"
            >
              <option value="regelinsolvenz">Regelinsolvenz</option>
              <option value="verbraucherinsolvenz">Verbraucherinsolvenz</option>
              <option value="unternehmensinsolvenz">Unternehmensinsolvenz</option>
            </select>
          </div>
          <Field label="Gesamtschulden (€)" name="total_debt" type="number" placeholder="0.00" />
          <div>
            <label className="block text-xs font-medium text-ash mb-1">Notizen</label>
            <textarea
              name="notes"
              rows={4}
              className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oxblood/40"
              placeholder="Erste Einschätzung, Besonderheiten…"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full bg-ink text-paper rounded-sm py-2.5 text-sm font-medium hover:bg-ink/90 transition-colors"
        >
          Akte anlegen
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ash mb-1">
        {label} {required && <span className="text-oxblood">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        placeholder={placeholder}
        className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oxblood/40"
      />
    </div>
  );
}
