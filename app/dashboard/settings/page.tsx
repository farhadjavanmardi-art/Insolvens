import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user.id).single();

  const { data: settings } = await supabase
    .from("firm_ai_settings")
    .select("provider, dpa_confirmed, updated_at")
    .eq("firm_id", profile?.firm_id)
    .maybeSingle();

  async function saveAISettings(formData: FormData) {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user.id).single();
    if (!profile) return;

    const provider = String(formData.get("provider"));
    const apiKey = String(formData.get("api_key") ?? "").trim();
    const dpaConfirmed = formData.get("dpa_confirmed") === "on";

    if (!dpaConfirmed) {
      throw new Error(
        "Ohne Bestätigung einer Auftragsverarbeitungsvereinbarung (AVV) können KI-Funktionen nicht aktiviert werden."
      );
    }

    const payload: any = { firm_id: profile.firm_id, provider, dpa_confirmed: dpaConfirmed, updated_at: new Date().toISOString() };
    if (apiKey) payload.api_key = apiKey;

    if (apiKey) {
      await supabase.from("firm_ai_settings").upsert(payload, { onConflict: "firm_id" });
    } else {
      // Keep existing key, just update provider/consent flag
      await supabase
        .from("firm_ai_settings")
        .update({ provider, dpa_confirmed: dpaConfirmed, updated_at: new Date().toISOString() })
        .eq("firm_id", profile.firm_id);
    }

    redirect("/dashboard/settings");
  }

  async function disableAI() {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user.id).single();
    if (!profile) return;
    await supabase.from("firm_ai_settings").delete().eq("firm_id", profile.firm_id);
    redirect("/dashboard/settings");
  }

  return (
    <div className="p-10 max-w-xl">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-1">Einstellungen</h1>
      <p className="text-sm text-ash mb-8">KI-Anbindung für Voice-to-Email und Foto-to-Email</p>

      <div className="bg-white border border-ink/10 rounded-sm p-6 mb-6">
        <p className="text-xs text-oxblood border border-oxblood/30 bg-oxblood/5 rounded-sm px-3 py-2 mb-5 leading-relaxed">
          Datenschutzhinweis: Sprachnotizen und Fotos werden bei Nutzung dieser Funktion an den unten gewählten
          externen KI-Anbieter übermittelt und dort verarbeitet. Es erfolgt keine dauerhafte Speicherung durch
          InsolvenzFlow. Diese Funktion darf erst genutzt werden, wenn eine Auftragsverarbeitungsvereinbarung
          (AVV) mit dem Anbieter vorliegt.
        </p>

        {settings && (
          <div className="text-sm text-moss mb-4">
            ✓ Konfiguriert: {settings.provider} ·{" "}
            {settings.dpa_confirmed ? "AVV bestätigt" : "AVV nicht bestätigt"}
          </div>
        )}

        <form action={saveAISettings} className="space-y-4">
          <div>
            <label className="label">Anbieter</label>
            <select name="provider" className="input w-full" defaultValue={settings?.provider ?? "openai"}>
              <option value="openai">OpenAI (für Voice-to-Email erforderlich)</option>
              <option value="anthropic">Anthropic Claude (nur Foto-to-Email)</option>
            </select>
          </div>
          <div>
            <label className="label">API-Schlüssel {settings && "(leer lassen, um bestehenden zu behalten)"}</label>
            <input
              type="password"
              name="api_key"
              placeholder={settings ? "•••••••••••••••• (unverändert lassen)" : "sk-..."}
              className="input w-full"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-ash">
            <input type="checkbox" name="dpa_confirmed" defaultChecked={settings?.dpa_confirmed} className="mt-0.5" />
            <span>
              Ich bestätige, dass unsere Kanzlei eine Auftragsverarbeitungsvereinbarung (AVV) mit dem gewählten
              KI-Anbieter abgeschlossen hat und die Übermittlung von Mandantendaten an diesen Anbieter zulässig ist.
            </span>
          </label>
          <button type="submit" className="btn">
            Speichern
          </button>
        </form>
      </div>

      {settings && (
        <form action={disableAI}>
          <button type="submit" className="text-sm text-oxblood underline">
            KI-Funktionen deaktivieren &amp; Schlüssel löschen
          </button>
        </form>
      )}
    </div>
  );
}
