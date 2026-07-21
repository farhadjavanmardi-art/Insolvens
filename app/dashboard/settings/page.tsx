import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("firm_id, calendar_feed_token")
    .eq("id", user.id)
    .single();

  const hdrs = headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const siteOrigin = host ? `${proto}://${host}` : "";

  const { data: settings } = await supabase
    .from("firm_ai_settings")
    .select("provider, dpa_confirmed, updated_at")
    .eq("firm_id", profile?.firm_id)
    .maybeSingle();

  const { data: emailSettings } = await supabase
    .from("firm_email_settings")
    .select("from_email, from_name, updated_at")
    .eq("firm_id", profile?.firm_id)
    .maybeSingle();

  async function saveEmailSettings(formData: FormData) {
    "use server";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user.id).single();
    if (!profile) return;

    const fromEmail = String(formData.get("from_email") ?? "").trim();
    const fromName = String(formData.get("from_name") ?? "").trim();
    const apiKey = String(formData.get("resend_api_key") ?? "").trim();

    const { data: existing } = await supabase
      .from("firm_email_settings")
      .select("resend_api_key")
      .eq("firm_id", profile.firm_id)
      .maybeSingle();

    await supabase.from("firm_email_settings").upsert(
      {
        firm_id: profile.firm_id,
        from_email: fromEmail,
        from_name: fromName || null,
        resend_api_key: apiKey || existing?.resend_api_key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "firm_id" }
    );
    redirect("/dashboard/settings");
  }

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

      <div className="bg-white border border-ink/10 rounded-sm p-6 mt-10">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-3">
          E-Mail-Versand (Resend) — für automatische Antworten
        </h2>
        <p className="text-xs text-ash mb-4">
          Wird genutzt, um nach Ihrer Freigabe automatisch eine Eingangsbestätigung an neue Mandanten zu senden
          (Menü &quot;Neue Anfragen&quot;). Ohne diese Einrichtung müssen Sie Antworten manuell versenden.
        </p>
        {emailSettings && (
          <div className="text-sm text-moss mb-4">
            ✓ Konfiguriert: {emailSettings.from_name ? `${emailSettings.from_name} <${emailSettings.from_email}>` : emailSettings.from_email}
          </div>
        )}
        <form action={saveEmailSettings} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Absender-Name</label>
              <input name="from_name" defaultValue={emailSettings?.from_name ?? ""} className="input w-full" placeholder="Kanzlei Mustermann" />
            </div>
            <div>
              <label className="label">Absender-E-Mail (bei Resend verifiziert)</label>
              <input
                name="from_email"
                type="email"
                required
                defaultValue={emailSettings?.from_email ?? ""}
                className="input w-full"
                placeholder="kanzlei@ihre-domain.de"
              />
            </div>
          </div>
          <div>
            <label className="label">Resend API-Schlüssel {emailSettings && "(leer lassen, um bestehenden zu behalten)"}</label>
            <input type="password" name="resend_api_key" placeholder={emailSettings ? "•••••••••• (unverändert lassen)" : "re_..."} className="input w-full" />
          </div>
          <button type="submit" className="btn">
            Speichern
          </button>
        </form>
      </div>

      <div className="bg-white border border-ink/10 rounded-sm p-6 mt-10">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-3">Kalender-Abo (Fristen)</h2>
        <p className="text-xs text-ash mb-4">
          Fügen Sie diese Adresse als &quot;Kalender per URL abonnieren&quot; in Google Kalender, Outlook oder Apple
          Kalender hinzu — Ihre offenen Fristen erscheinen dann automatisch und aktuell in Ihrem eigenen Kalender.
        </p>
        <code className="text-xs text-oxblood break-all block bg-paper/50 p-3 rounded-sm">
          {`${siteOrigin}/api/calendar/${profile?.calendar_feed_token}`}
        </code>
      </div>
    </div>
  );
}
