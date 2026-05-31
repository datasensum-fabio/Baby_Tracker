"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadSettings, saveSettings, BabySettings } from "@/lib/settings";
import { ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel } from "@/lib/helpers";
import { ArrowLeft, Check } from "lucide-react";

const TYPES: ActivityType[] = ["feed", "sleep", "medication", "nappy"];

const KEY_MAP: Record<ActivityType, keyof BabySettings> = {
  feed: "feed_alert_min",
  sleep: "sleep_alert_min",
  medication: "medication_alert_min",
  nappy: "nappy_alert_min",
};

const PRESETS: Record<ActivityType, { label: string; minutes: number }[]> = {
  feed: [
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "4h", minutes: 240 },
    { label: "5h", minutes: 300 },
  ],
  sleep: [
    { label: "30m", minutes: 30 },
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "4h", minutes: 240 },
  ],
  medication: [
    { label: "4h", minutes: 240 },
    { label: "6h", minutes: 360 },
    { label: "8h", minutes: 480 },
    { label: "12h", minutes: 720 },
    { label: "24h", minutes: 1440 },
  ],
  nappy: [
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "4h", minutes: 240 },
    { label: "6h", minutes: 360 },
  ],
};

const BORDER: Record<ActivityType, string> = {
  feed: "border-feed", sleep: "border-sleep",
  medication: "border-medication", nappy: "border-nappy",
};
const BG: Record<ActivityType, string> = {
  feed: "bg-feed", sleep: "bg-sleep",
  medication: "bg-medication", nappy: "bg-nappy",
};

function minsToLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const babyId = params.id as string;

  const [babyName, setBabyName] = useState("");
  const [settings, setSettings] = useState<BabySettings | null>(null);
  const [customInputs, setCustomInputs] = useState<Record<ActivityType, string>>({ feed: "", sleep: "", medication: "", nappy: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: carer } = await supabase.from("carers").select("id").eq("baby_id", babyId).eq("user_id", user.id).single();
      if (!carer) { router.replace("/"); return; }
      const { data: baby } = await supabase.from("babies").select("name").eq("id", babyId).single();
      if (baby) setBabyName(baby.name);
      const s = await loadSettings(babyId);
      setSettings(s);
      setLoading(false);
    }
    load();
  }, [babyId, router]);

  function getMinutes(type: ActivityType): number | null {
    return settings ? settings[KEY_MAP[type]] : null;
  }

  function setMinutes(type: ActivityType, mins: number | null) {
    setSettings((prev) => prev ? { ...prev, [KEY_MAP[type]]: mins } : prev);
  }

  function toggleAlert(type: ActivityType) {
    const current = getMinutes(type);
    if (current !== null) {
      setMinutes(type, null);
    } else {
      // Re-enable with the first preset
      setMinutes(type, PRESETS[type][0].minutes);
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    await saveSettings(babyId, settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-bounce">👶</div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-sleep to-feed px-5 pt-10 pb-6 text-white flex items-center gap-3">
        <button onClick={() => router.push(`/baby/${babyId}`)} className="p-2 bg-white/20 rounded-full active:bg-white/30 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">⚙️ Alert Settings</h1>
          <p className="text-white/70 text-sm">{babyName}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        <p className="text-sm text-gray-500 px-1">
          Set how long after the last log each section turns red. Toggle off to disable alerts for that type.
        </p>

        {TYPES.map((type) => {
          const mins = getMinutes(type);
          const enabled = mins !== null;
          const presets = PRESETS[type];
          const isCustom = enabled && !presets.some((p) => p.minutes === mins);

          return (
            <div key={type} className={`bg-white rounded-2xl shadow-sm border-l-4 ${BORDER[type]} overflow-hidden`}>
              {/* Type header + toggle */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activityEmoji(type)}</span>
                  <span className="font-semibold text-gray-800">{activityLabel(type)}</span>
                  {enabled && <span className="text-xs text-gray-400">alert after {minsToLabel(mins!)}</span>}
                </div>
                {/* Toggle */}
                <button
                  onClick={() => toggleAlert(type)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? BG[type] : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Threshold picker — only shown when enabled */}
              {enabled && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Alert after</p>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p) => (
                      <button key={p.minutes} onClick={() => setMinutes(type, p.minutes)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                          mins === p.minutes ? `${BG[type]} text-white border-transparent` : "bg-white text-gray-600 border-gray-200"
                        }`}>
                        {p.label}
                      </button>
                    ))}
                    <button onClick={() => {
                        setCustomInputs((prev) => ({ ...prev, [type]: String(Math.round((mins ?? 60) / 60)) }));
                        setMinutes(type, mins ?? 60);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                        isCustom ? `${BG[type]} text-white border-transparent` : "bg-white text-gray-600 border-gray-200"
                      }`}>
                      Custom
                    </button>
                  </div>

                  {isCustom && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={customInputs[type]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomInputs((prev) => ({ ...prev, [type]: val }));
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed) && parsed > 0) {
                            setMinutes(type, Math.round(parsed * 60));
                          }
                        }}
                        placeholder="e.g. 2.5"
                        className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sleep"
                      />
                      <span className="text-sm text-gray-500">hours</span>
                      {customInputs[type] && <span className="text-xs text-gray-400">= {minsToLabel(Math.round(parseFloat(customInputs[type]) * 60))}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-sleep text-white rounded-2xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          {saved ? <><Check size={20} /> Saved!</> : saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
