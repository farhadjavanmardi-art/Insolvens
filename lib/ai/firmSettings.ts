import { createClient } from "@/lib/supabase/server";
import type { AIProvider } from "@/lib/ai/providers";

export type FirmAISettings = { provider: AIProvider; apiKey: string };

/**
 * Loads the current firm's AI settings. Returns null if not configured or if the
 * firm has not confirmed a Data Processing Agreement (AVV) with the provider —
 * AI features must not run without that confirmation on file.
 */
export async function getFirmAISettings(): Promise<FirmAISettings | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("firm_id").eq("id", user.id).single();
  if (!profile) return null;

  const { data: settings } = await supabase
    .from("firm_ai_settings")
    .select("provider, api_key, dpa_confirmed")
    .eq("firm_id", profile.firm_id)
    .maybeSingle();

  if (!settings || !settings.dpa_confirmed) return null;

  return { provider: settings.provider as AIProvider, apiKey: settings.api_key };
}
