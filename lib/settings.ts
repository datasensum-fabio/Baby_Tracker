import { supabase } from "./supabase";

export interface BabySettings {
  feed_alert_min: number | null;
  sleep_alert_min: number | null;
  medication_alert_min: number | null;
  nappy_alert_min: number | null;
}

export const DEFAULT_SETTINGS: BabySettings = {
  feed_alert_min: 180,
  sleep_alert_min: null,
  medication_alert_min: 720,
  nappy_alert_min: null,
};

export async function loadSettings(babyId: string): Promise<BabySettings> {
  const { data } = await supabase
    .from("baby_settings")
    .select("feed_alert_min, sleep_alert_min, medication_alert_min, nappy_alert_min")
    .eq("baby_id", babyId)
    .single();
  return data ?? DEFAULT_SETTINGS;
}

export async function saveSettings(babyId: string, settings: BabySettings): Promise<void> {
  await supabase
    .from("baby_settings")
    .upsert({ baby_id: babyId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "baby_id" });
}
