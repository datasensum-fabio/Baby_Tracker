"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType, Drug } from "@/lib/types";
import { activityEmoji, activityLabel } from "@/lib/helpers";
import { X, Trash2 } from "lucide-react";
import { format, subMinutes } from "date-fns";

interface Props {
  type: ActivityType;
  babyId: string;
  carerId: string;
  existing?: Activity;
  onClose: () => void;
  onSaved: () => void;
}

const colorButton: Record<ActivityType, string> = {
  feed: "bg-feed", sleep: "bg-sleep", medication: "bg-medication", nappy: "bg-nappy",
};
const colorRing: Record<ActivityType, string> = {
  feed: "focus:ring-feed", sleep: "focus:ring-sleep", medication: "focus:ring-medication", nappy: "focus:ring-nappy",
};

function initField<T>(existing: Activity | undefined, key: string, fallback: T): T {
  if (!existing) return fallback;
  const val = (existing.details as unknown as Record<string, unknown>)[key];
  return val !== undefined ? (val as T) : fallback;
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Failed to save.";
}

const TIME_PRESETS = [
  { label: "Now",     minutes: 0 },
  { label: "1m ago",  minutes: 1 },
  { label: "5m ago",  minutes: 5 },
  { label: "10m ago", minutes: 10 },
  { label: "15m ago", minutes: 15 },
  { label: "30m ago", minutes: 30 },
  { label: "1h ago",  minutes: 60 },
];

function offsetToDateStr(minutesAgo: number): string {
  const d = minutesAgo === 0 ? new Date() : subMinutes(new Date(), minutesAgo);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function LogModal({ type, babyId, carerId, existing, onClose, onSaved }: Props) {
  const isEdit = !!existing;

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // Time picker — preset chip or custom datetime
  const [timePreset, setTimePreset] = useState<number | "custom">(isEdit ? "custom" : 0);
  const [customTime, setCustomTime] = useState(
    existing
      ? format(new Date(existing.logged_at), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );

  function getLoggedAt(): string {
    if (timePreset === "custom") return new Date(customTime).toISOString();
    return subMinutes(new Date(), timePreset as number).toISOString();
  }

  // Feed fields
  const [feedType, setFeedType] = useState<string>(initField(existing, "feed_type", "formula"));
  const [amountMl, setAmountMl] = useState<string>(String(initField(existing, "amount_ml", "") ?? ""));
  const [durationMin, setDurationMin] = useState<string>(String(initField(existing, "duration_min", "") ?? ""));

  // Sleep
  const [sleepDuration, setSleepDuration] = useState<string>(String(initField(existing, "duration_min", "") ?? ""));

  // Medication
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [selectedDrugId, setSelectedDrugId] = useState<string | "manual" | null>(null);
  const [medName, setMedName] = useState<string>(initField(existing, "name", ""));
  const [medDose, setMedDose] = useState<string>(String(initField(existing, "dose", "") ?? ""));
  const [medUnit, setMedUnit] = useState<string>(initField(existing, "unit", "ml"));

  // Load drugs when opening medication modal
  useEffect(() => {
    if (type !== "medication") return;
    supabase.from("baby_drugs").select("*").eq("baby_id", babyId).order("sort_order")
      .then(({ data }) => {
        if (data) {
          setDrugs(data);
          if (!existing) {
            // Pre-select default drug
            const def = data.find((d: Drug) => d.is_default) ?? data[0];
            if (def) {
              setSelectedDrugId(def.id);
              setMedName(def.name);
              setMedDose(def.default_dose ? String(def.default_dose) : "");
              setMedUnit(def.default_unit);
            } else {
              setSelectedDrugId("manual");
            }
          } else {
            // Editing: match existing drug by name or set manual
            const match = data.find((d: Drug) => d.name === initField(existing, "name", ""));
            setSelectedDrugId(match ? match.id : "manual");
          }
        } else {
          setSelectedDrugId("manual");
        }
      });
  }, [type, babyId, existing]);

  // Nappy
  const [nappyType, setNappyType] = useState<string>(initField(existing, "nappy_type", "wet"));
  const [nappyColor, setNappyColor] = useState<string>(initField(existing, "color", ""));

  function buildDetails(): Record<string, unknown> | null {
    if (type === "feed") {
      if (feedType === "formula" || feedType === "bottle") {
        if (!amountMl || parseFloat(amountMl) <= 0) { setError("Please enter the amount in ml."); return null; }
      } else {
        if (!durationMin || parseFloat(durationMin) <= 0) { setError("Please enter the duration in minutes."); return null; }
      }
      const d: Record<string, unknown> = { feed_type: feedType };
      if (feedType === "formula" || feedType === "bottle") d.amount_ml = parseFloat(amountMl);
      else d.duration_min = parseFloat(durationMin);
      return d;
    }
    if (type === "sleep") {
      const d: Record<string, unknown> = { start_time: getLoggedAt() };
      if (sleepDuration) d.duration_min = parseFloat(sleepDuration);
      return d;
    }
    if (type === "medication") {
      if (!medName.trim() || !medDose) { setError("Please enter medication name and dose."); return null; }
      return { name: medName.trim(), dose: parseFloat(medDose), unit: medUnit };
    }
    if (type === "nappy") {
      const d: Record<string, unknown> = { nappy_type: nappyType };
      if (nappyColor) d.color = nappyColor;
      return d;
    }
    return {};
  }

  async function handleSave() {
    const details = buildDetails();
    if (!details) return;
    setLoading(true);
    setError("");
    try {
      if (isEdit && existing) {
        const { error: err } = await supabase.from("activities")
          .update({ details, notes: notes.trim() || null, logged_at: getLoggedAt() })
          .eq("id", existing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("activities").insert({
          baby_id: babyId, carer_id: carerId, type, details,
          notes: notes.trim() || null, logged_at: getLoggedAt(),
        });
        if (err) throw err;
      }
      onSaved();
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    try {
      // Soft delete — keeps the record for restore
      const { error: err } = await supabase.from("activities")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (err) throw err;
      onSaved();
    } catch (e) { setError(errMsg(e)); setDeleting(false); setConfirmDelete(false); }
  }

  const ring = colorRing[type];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{activityEmoji(type)} {isEdit ? "Edit" : "Log"} {activityLabel(type)}</h2>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-full bg-red-50 text-red-400 active:bg-red-100">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:bg-gray-200"><X size={20} /></button>
          </div>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <p className="text-red-700 font-medium text-sm">Delete this activity? You can restore it from the trash.</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 font-semibold text-sm disabled:opacity-50">
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-xl py-2 font-semibold text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── TIME PICKER ── */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">When</label>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={() => setTimePreset(p.minutes)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                  timePreset === p.minutes
                    ? `${colorButton[type]} text-white border-transparent`
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setTimePreset("custom")}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                timePreset === "custom"
                  ? `${colorButton[type]} text-white border-transparent`
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              Custom
            </button>
          </div>
          {timePreset === "custom" && (
            <input type="datetime-local" value={customTime} onChange={(e) => setCustomTime(e.target.value)}
              className={`mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 ${ring}`} />
          )}
        </div>

        {/* ── FEED ── */}
        {type === "feed" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Feed type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "breast_left", label: "Left breast" },
                  { value: "breast_right", label: "Right breast" },
                  { value: "both_breasts", label: "Both breasts" },
                  { value: "formula", label: "Formula" },
                  { value: "bottle", label: "Bottle" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setFeedType(opt.value)}
                    className={`rounded-xl p-3 text-sm font-medium border-2 transition-colors ${
                      feedType === opt.value ? "bg-feed text-white border-feed" : "bg-white text-gray-700 border-gray-200"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {feedType === "formula" || feedType === "bottle" ? (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (ml) <span className="text-red-400">*</span></label>
                <input type="number" value={amountMl} onChange={(e) => setAmountMl(e.target.value)} placeholder="e.g. 120"
                  className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 ${ring}`} />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Duration (minutes) <span className="text-red-400">*</span></label>
                <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="e.g. 15"
                  className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 ${ring}`} />
              </div>
            )}
          </>
        )}

        {/* ── SLEEP ── */}
        {type === "sleep" && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Duration (minutes, optional)</label>
            <input type="number" value={sleepDuration} onChange={(e) => setSleepDuration(e.target.value)}
              placeholder="Leave blank if still sleeping"
              className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 ${ring}`} />
          </div>
        )}

        {/* ── MEDICATION ── */}
        {type === "medication" && (
          <>
            {/* Drug picker */}
            {drugs.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Select drug</label>
                <div className="flex flex-wrap gap-2">
                  {drugs.map((d) => (
                    <button key={d.id}
                      onClick={() => {
                        setSelectedDrugId(d.id);
                        setMedName(d.name);
                        setMedDose(d.default_dose ? String(d.default_dose) : "");
                        setMedUnit(d.default_unit);
                      }}
                      className={`rounded-xl px-3 py-2 text-sm font-medium border-2 transition-colors ${
                        selectedDrugId === d.id ? "bg-medication text-white border-medication" : "bg-white text-gray-700 border-gray-200"
                      }`}>
                      {d.name}{d.default_dose ? ` ${d.default_dose}${d.default_unit}` : ""}
                      {d.is_default && <span className="ml-1 text-[10px] opacity-70">★</span>}
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedDrugId("manual"); setMedName(""); setMedDose(""); }}
                    className={`rounded-xl px-3 py-2 text-sm font-medium border-2 transition-colors ${
                      selectedDrugId === "manual" ? "bg-medication text-white border-medication" : "bg-white text-gray-700 border-gray-200"
                    }`}>
                    Other…
                  </button>
                </div>
              </div>
            )}
            {/* Manual name entry — shown when no drugs or "Other" selected */}
            {(drugs.length === 0 || selectedDrugId === "manual") && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Medication name *</label>
                <input type="text" value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="e.g. Propranolol"
                  className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 ${ring}`} />
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">Dose *</label>
                <input type="number" value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="e.g. 0.6" step="0.1"
                  className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 ${ring}`} />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-gray-600 mb-1">Unit</label>
                <select value={medUnit} onChange={(e) => setMedUnit(e.target.value)}
                  className={`w-full border border-gray-200 rounded-xl px-3 py-3 text-lg focus:outline-none focus:ring-2 ${ring} bg-white`}>
                  {["ml", "mg", "drops", "tablet"].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* ── NAPPY ── */}
        {type === "nappy" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nappy type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "wet", label: "💧 Wet" },
                  { value: "dirty", label: "💩 Dirty" },
                  { value: "both", label: "💧💩 Both" },
                  { value: "dry", label: "✅ Dry" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setNappyType(opt.value)}
                    className={`rounded-xl p-3 text-sm font-medium border-2 transition-colors ${
                      nappyType === opt.value ? "bg-nappy text-white border-nappy" : "bg-white text-gray-700 border-gray-200"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Colour (optional)</label>
              <input type="text" value={nappyColor} onChange={(e) => setNappyColor(e.target.value)} placeholder="e.g. yellow, green"
                className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 ${ring}`} />
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra notes..." rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={handleSave} disabled={loading}
          className={`w-full ${colorButton[type]} text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform`}>
          {loading ? "Saving..." : isEdit ? `Update ${activityLabel(type)}` : `Save ${activityLabel(type)}`}
        </button>
      </div>
    </div>
  );
}
