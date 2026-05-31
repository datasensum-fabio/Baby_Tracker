"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel } from "@/lib/helpers";
import { X, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  type: ActivityType;
  existing?: Activity;
  onClose: () => void;
  onSaved: () => void;
}

const colorButton: Record<ActivityType, string> = {
  feed: "bg-feed",
  sleep: "bg-sleep",
  medication: "bg-medication",
  nappy: "bg-nappy",
};

function initField<T>(existing: Activity | undefined, key: string, fallback: T): T {
  if (!existing) return fallback;
  const val = (existing.details as unknown as Record<string, unknown>)[key];
  return val !== undefined ? (val as T) : fallback;
}

export default function LogModal({ type, existing, onClose, onSaved }: Props) {
  const isEdit = !!existing;

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loggedAt, setLoggedAt] = useState(
    existing
      ? format(new Date(existing.logged_at), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );

  // Feed fields
  const [feedType, setFeedType] = useState<string>(initField(existing, "feed_type", "formula"));
  const [amountMl, setAmountMl] = useState<string>(String(initField(existing, "amount_ml", "") ?? ""));
  const [durationMin, setDurationMin] = useState<string>(String(initField(existing, "duration_min", "") ?? ""));

  // Sleep fields
  const [sleepDuration, setSleepDuration] = useState<string>(String(initField(existing, "duration_min", "") ?? ""));

  // Medication fields
  const [medName, setMedName] = useState<string>(initField(existing, "name", ""));
  const [medDose, setMedDose] = useState<string>(String(initField(existing, "dose", "") ?? ""));
  const [medUnit, setMedUnit] = useState<string>(initField(existing, "unit", "ml"));

  // Nappy fields
  const [nappyType, setNappyType] = useState<string>(initField(existing, "nappy_type", "wet"));
  const [nappyColor, setNappyColor] = useState<string>(initField(existing, "color", ""));

  function buildDetails(): Record<string, unknown> | null {
    if (type === "feed") {
      const d: Record<string, unknown> = { feed_type: feedType };
      if (feedType === "formula" || feedType === "bottle") {
        if (amountMl) d.amount_ml = parseFloat(amountMl);
      } else {
        if (durationMin) d.duration_min = parseFloat(durationMin);
      }
      return d;
    }
    if (type === "sleep") {
      const d: Record<string, unknown> = { start_time: loggedAt };
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
        const { error: err } = await supabase
          .from("activities")
          .update({ details, notes: notes.trim() || null, logged_at: new Date(loggedAt).toISOString() })
          .eq("id", existing.id);
        if (err) throw err;
      } else {
        const babyId = localStorage.getItem("baby_id");
        const carerId = localStorage.getItem("carer_id");
        if (!babyId || !carerId) return;
        const { error: err } = await supabase.from("activities").insert({
          baby_id: babyId, carer_id: carerId, type, details,
          notes: notes.trim() || null,
          logged_at: new Date(loggedAt).toISOString(),
        });
        if (err) throw err;
      }
      onSaved();
    } catch (e: unknown) {
      setError(e && typeof e === "object" && "message" in e ? String((e as {message:unknown}).message) : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("activities").delete().eq("id", existing.id);
      if (err) throw err;
      onSaved();
    } catch (e: unknown) {
      setError(e && typeof e === "object" && "message" in e ? String((e as {message:unknown}).message) : "Failed to delete.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {activityEmoji(type)} {isEdit ? "Edit" : "Log"} {activityLabel(type)}
          </h2>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-full bg-red-50 text-red-400 active:bg-red-100"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:bg-gray-200">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <p className="text-red-700 font-medium text-sm">Delete this activity?</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 font-semibold text-sm disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-xl py-2 font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">When</label>
          <input
            type="datetime-local"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sleep"
          />
        </div>

        {/* Feed */}
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
                  <button
                    key={opt.value}
                    onClick={() => setFeedType(opt.value)}
                    className={`rounded-xl p-3 text-sm font-medium border-2 transition-colors ${
                      feedType === opt.value ? "bg-feed text-white border-feed" : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {feedType === "formula" || feedType === "bottle" ? (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (ml)</label>
                <input type="number" value={amountMl} onChange={(e) => setAmountMl(e.target.value)} placeholder="e.g. 120"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-feed" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Duration (minutes)</label>
                <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="e.g. 15"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-feed" />
              </div>
            )}
          </>
        )}

        {/* Sleep */}
        {type === "sleep" && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Duration (minutes, optional)</label>
            <input type="number" value={sleepDuration} onChange={(e) => setSleepDuration(e.target.value)}
              placeholder="Leave blank if still sleeping"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
          </div>
        )}

        {/* Medication */}
        {type === "medication" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Medication name *</label>
              <input type="text" value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="e.g. Calpol"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-medication" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">Dose *</label>
                <input type="number" value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="e.g. 2.5" step="0.5"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-medication" />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-gray-600 mb-1">Unit</label>
                <select value={medUnit} onChange={(e) => setMedUnit(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-medication bg-white">
                  {["ml", "mg", "drops", "tablet"].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* Nappy */}
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
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-nappy" />
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
