"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadSettings, saveSettings, BabySettings } from "@/lib/settings";
import { Drug } from "@/lib/types";
import { ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel } from "@/lib/helpers";
import { ArrowLeft, Check, Plus, Trash2, Star, Bell, BellOff } from "lucide-react";
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, isPushSupported } from "@/lib/pushClient";

const NON_MED_TYPES: ActivityType[] = ["feed", "sleep", "nappy"];

const KEY_MAP: Record<ActivityType, keyof BabySettings> = {
  feed: "feed_alert_min",
  sleep: "sleep_alert_min",
  medication: "medication_alert_min",
  nappy: "nappy_alert_min",
};

const PRESETS: Record<ActivityType, { label: string; minutes: number }[]> = {
  feed: [
    { label: "1h", minutes: 60 }, { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 }, { label: "4h", minutes: 240 }, { label: "5h", minutes: 300 },
  ],
  sleep: [
    { label: "30m", minutes: 30 }, { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 }, { label: "3h", minutes: 180 }, { label: "4h", minutes: 240 },
  ],
  medication: [],
  nappy: [
    { label: "1h", minutes: 60 }, { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 }, { label: "4h", minutes: 240 }, { label: "6h", minutes: 360 },
  ],
};

const DRUG_ALERT_PRESETS = [
  { label: "4h", minutes: 240 }, { label: "6h", minutes: 360 },
  { label: "8h", minutes: 480 }, { label: "12h", minutes: 720 }, { label: "24h", minutes: 1440 },
];

const BORDER: Record<ActivityType, string> = {
  feed: "border-feed", sleep: "border-sleep", medication: "border-medication", nappy: "border-nappy",
};
const BG: Record<ActivityType, string> = {
  feed: "bg-feed", sleep: "bg-sleep", medication: "bg-medication", nappy: "bg-nappy",
};

function minsToLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const babyId = params.id as string;

  const [babyName, setBabyName] = useState("");
  const [settings, setSettings] = useState<BabySettings | null>(null);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState("");
  const [carerId, setCarerId] = useState("");

  // New drug form
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [newDrugName, setNewDrugName] = useState("");
  const [newDrugDose, setNewDrugDose] = useState("");
  const [newDrugUnit, setNewDrugUnit] = useState("ml");
  const [newDrugAlert, setNewDrugAlert] = useState<number | null>(null);
  const [savingDrug, setSavingDrug] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: carer } = await supabase.from("carers").select("id").eq("baby_id", babyId).eq("user_id", user.id).single();
      if (!carer) { router.replace("/"); return; }
      setCarerId(carer.id);
      const { data: baby } = await supabase.from("babies").select("name").eq("id", babyId).single();
      if (baby) setBabyName(baby.name);
      const [s, { data: drugsData }] = await Promise.all([
        loadSettings(babyId),
        supabase.from("baby_drugs").select("*").eq("baby_id", babyId).order("sort_order"),
      ]);
      setSettings(s);
      if (drugsData) setDrugs(drugsData);
      setPushSupported(isPushSupported());
      setPushEnabled(await isPushSubscribed());
      setLoading(false);
    }
    load();
  }, [babyId, router]);

  function getMinutes(type: ActivityType): number | null {
    return settings ? settings[KEY_MAP[type]] as number | null : null;
  }
  function setMinutes(type: ActivityType, mins: number | null) {
    setSettings((prev) => prev ? { ...prev, [KEY_MAP[type]]: mins } : prev);
  }
  function toggleAlert(type: ActivityType) {
    const current = getMinutes(type);
    if (current !== null) { setMinutes(type, null); }
    else { setMinutes(type, PRESETS[type][0]?.minutes ?? 180); }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    await saveSettings(babyId, settings);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function addDrug() {
    if (!newDrugName.trim()) return;
    setSavingDrug(true);
    const { data } = await supabase.from("baby_drugs").insert({
      baby_id: babyId,
      name: newDrugName.trim(),
      default_dose: newDrugDose ? parseFloat(newDrugDose) : null,
      default_unit: newDrugUnit,
      alert_min: newDrugAlert,
      is_default: drugs.length === 0, // first drug becomes default automatically
      sort_order: drugs.length,
    }).select().single();
    if (data) setDrugs((prev) => [...prev, data]);
    setNewDrugName(""); setNewDrugDose(""); setNewDrugUnit("ml"); setNewDrugAlert(null);
    setShowAddDrug(false); setSavingDrug(false);
  }

  async function deleteDrug(id: string) {
    await supabase.from("baby_drugs").delete().eq("id", id);
    setDrugs((prev) => prev.filter((d) => d.id !== id));
  }

  async function setDefault(id: string) {
    // Clear all defaults then set this one
    await supabase.from("baby_drugs").update({ is_default: false }).eq("baby_id", babyId);
    await supabase.from("baby_drugs").update({ is_default: true }).eq("id", id);
    setDrugs((prev) => prev.map((d) => ({ ...d, is_default: d.id === id })));
  }

  async function updateDrugAlert(id: string, mins: number | null) {
    await supabase.from("baby_drugs").update({ alert_min: mins }).eq("id", id);
    setDrugs((prev) => prev.map((d) => d.id === id ? { ...d, alert_min: mins } : d));
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-bounce">👶</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      <div className="bg-gradient-to-r from-sleep to-feed px-5 pt-10 pb-6 text-white flex items-center gap-3">
        <button onClick={() => router.push(`/baby/${babyId}`)} className="p-2 bg-white/20 rounded-full active:bg-white/30 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">⚙️ Settings</h1>
          <p className="text-white/70 text-sm">{babyName}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* ── MEDICATION / DRUGS ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">💊 Medications</p>
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-medication overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm text-gray-500">Add each drug you give. Set an alert time per drug and choose which is the default when logging.</p>
            </div>

            {drugs.length === 0 && (
              <div className="px-4 py-4 text-sm text-gray-400 text-center">No drugs added yet</div>
            )}

            {drugs.map((drug) => (
              <div key={drug.id} className="border-b border-gray-50 last:border-0">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{drug.name}</p>
                      {drug.default_dose && (
                        <span className="text-xs text-gray-400">{drug.default_dose}{drug.default_unit}</span>
                      )}
                      {drug.is_default && (
                        <span className="text-xs bg-medication/10 text-medication-dark font-semibold px-2 py-0.5 rounded-full">Default</span>
                      )}
                    </div>
                    {/* Alert threshold for this drug */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs text-gray-400 self-center">Alert:</span>
                      {[...DRUG_ALERT_PRESETS, { label: "Off", minutes: 0 }].map((p) => {
                        const isActive = p.minutes === 0 ? drug.alert_min === null : drug.alert_min === p.minutes;
                        return (
                          <button key={p.label}
                            onClick={() => updateDrugAlert(drug.id, p.minutes === 0 ? null : p.minutes)}
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-colors ${
                              isActive ? "bg-medication text-white border-transparent" : "bg-white text-gray-500 border-gray-200"
                            }`}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!drug.is_default && (
                      <button onClick={() => setDefault(drug.id)} title="Set as default"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-yellow-400 hover:bg-yellow-50 active:bg-yellow-100">
                        <Star size={16} />
                      </button>
                    )}
                    <button onClick={() => deleteDrug(drug.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 active:bg-red-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add drug form */}
            {showAddDrug ? (
              <div className="px-4 py-4 space-y-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700">New drug</p>
                <input type="text" value={newDrugName} onChange={(e) => setNewDrugName(e.target.value)}
                  placeholder="Drug name (e.g. Propranolol)" autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medication" />
                <div className="flex gap-2">
                  <input type="number" value={newDrugDose} onChange={(e) => setNewDrugDose(e.target.value)}
                    placeholder="Default dose" step="0.1"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medication" />
                  <select value={newDrugUnit} onChange={(e) => setNewDrugUnit(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medication bg-white">
                    {["ml", "mg", "drops", "tablet"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Alert after (optional)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DRUG_ALERT_PRESETS.map((p) => (
                      <button key={p.minutes} onClick={() => setNewDrugAlert(newDrugAlert === p.minutes ? null : p.minutes)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
                          newDrugAlert === p.minutes ? "bg-medication text-white border-transparent" : "bg-white text-gray-500 border-gray-200"
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addDrug} disabled={savingDrug || !newDrugName.trim()}
                    className="flex-1 bg-medication text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
                    {savingDrug ? "Adding..." : "Add drug"}
                  </button>
                  <button onClick={() => setShowAddDrug(false)}
                    className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-2 text-sm font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddDrug(true)}
                className="w-full flex items-center justify-center gap-2 text-medication-dark text-sm font-semibold py-3 hover:bg-medication/5 active:bg-medication/10 transition-colors">
                <Plus size={16} /> Add drug
              </button>
            )}
          </div>
        </div>

        {/* ── OTHER ACTIVITY ALERTS ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Other alerts</p>
          <div className="space-y-3">
            {NON_MED_TYPES.map((type) => {
              const mins = getMinutes(type);
              const enabled = mins !== null;
              const presets = PRESETS[type];
              const isCustom = enabled && !presets.some((p) => p.minutes === mins);
              return (
                <div key={type} className={`bg-white rounded-2xl shadow-sm border-l-4 ${BORDER[type]} overflow-hidden`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{activityEmoji(type)}</span>
                      <span className="font-semibold text-gray-800">{activityLabel(type)}</span>
                      {enabled && <span className="text-xs text-gray-400">alert after {minsToLabel(mins!)}</span>}
                    </div>
                    <button onClick={() => toggleAlert(type)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? BG[type] : "bg-gray-200"}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
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
                        <button onClick={() => { setCustomInputs((prev) => ({ ...prev, [type]: String(Math.round((mins ?? 60) / 60)) })); setMinutes(type, mins ?? 60); }}
                          className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                            isCustom ? `${BG[type]} text-white border-transparent` : "bg-white text-gray-600 border-gray-200"
                          }`}>
                          Custom
                        </button>
                      </div>
                      {isCustom && (
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} value={customInputs[type] ?? ""}
                            onChange={(e) => {
                              setCustomInputs((prev) => ({ ...prev, [type]: e.target.value }));
                              const p = parseFloat(e.target.value);
                              if (!isNaN(p) && p > 0) setMinutes(type, Math.round(p * 60));
                            }}
                            placeholder="e.g. 2.5"
                            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sleep" />
                          <span className="text-sm text-gray-500">hours</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PUSH NOTIFICATIONS ── */}
        {pushSupported && (
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-sleep p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {pushEnabled ? <Bell size={22} className="text-sleep flex-shrink-0" /> : <BellOff size={22} className="text-gray-300 flex-shrink-0" />}
              <div>
                <p className="font-semibold text-gray-800">Push notifications</p>
                <p className="text-xs text-gray-400">{pushEnabled ? "You'll get notified when alerts trigger" : "Enable to get alerts on this device"}</p>
              </div>
            </div>
            <button
              disabled={pushLoading}
              onClick={async () => {
                setPushLoading(true);
                setPushError("");
                if (pushEnabled) {
                  await unsubscribeFromPush();
                  setPushEnabled(false);
                } else {
                  const result = await subscribeToPush(carerId, babyId);
                  if (result.ok) {
                    setPushEnabled(true);
                  } else {
                    setPushError(result.reason);
                  }
                }
                setPushLoading(false);
              }}
              className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors disabled:opacity-50 px-1 ${pushEnabled ? "bg-sleep" : "bg-gray-200"}`}
              style={{ minWidth: "3.25rem" }}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${pushEnabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        )}

        {pushError && (
          <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-700 border border-red-100">
            <p className="font-semibold mb-0.5">Could not enable notifications</p>
            <p className="text-xs whitespace-pre-line">{pushError}</p>
          </div>
        )}

        {!pushSupported && (
          <div className="bg-amber-50 rounded-2xl p-4 text-sm text-amber-700 border border-amber-100">
            <p className="font-semibold mb-0.5">Push notifications not available</p>
            <p className="text-xs">On iPhone, install the app to the home screen via Safari first, then come back here.</p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-sleep text-white rounded-2xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2">
          {saved ? <><Check size={20} /> Saved!</> : saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
