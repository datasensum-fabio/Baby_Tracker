"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel } from "@/lib/helpers";
import { X } from "lucide-react";
import { format } from "date-fns";

interface Props {
  type: ActivityType;
  onClose: () => void;
  onSaved: () => void;
}

const colorButton: Record<ActivityType, string> = {
  feed: "bg-feed",
  sleep: "bg-sleep",
  medication: "bg-medication",
  nappy: "bg-nappy",
};

export default function LogModal({ type, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [loggedAt, setLoggedAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  // Feed fields
  const [feedType, setFeedType] = useState<string>("formula");
  const [amountMl, setAmountMl] = useState("");
  const [durationMin, setDurationMin] = useState("");

  // Sleep fields
  const [sleepDuration, setSleepDuration] = useState("");

  // Medication fields
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medUnit, setMedUnit] = useState("ml");

  // Nappy fields
  const [nappyType, setNappyType] = useState<string>("wet");
  const [nappyColor, setNappyColor] = useState("");

  async function handleSave() {
    const babyId = localStorage.getItem("baby_id");
    const carerId = localStorage.getItem("carer_id");
    if (!babyId || !carerId) return;

    let details: Record<string, unknown> = {};
    if (type === "feed") {
      details = { feed_type: feedType };
      if (feedType === "formula" || feedType === "bottle") {
        if (amountMl) details.amount_ml = parseFloat(amountMl);
      } else {
        if (durationMin) details.duration_min = parseFloat(durationMin);
      }
    } else if (type === "sleep") {
      details = { start_time: loggedAt };
      if (sleepDuration) details.duration_min = parseFloat(sleepDuration);
    } else if (type === "medication") {
      if (!medName.trim() || !medDose) { setError("Please enter medication name and dose."); return; }
      details = { name: medName.trim(), dose: parseFloat(medDose), unit: medUnit };
    } else if (type === "nappy") {
      details = { nappy_type: nappyType };
      if (nappyColor) details.color = nappyColor;
    }

    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.from("activities").insert({
        baby_id: babyId,
        carer_id: carerId,
        type,
        details,
        notes: notes.trim() || null,
        logged_at: new Date(loggedAt).toISOString(),
      });
      if (err) throw err;
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setLoading(false);
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
            {activityEmoji(type)} Log {activityLabel(type)}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:bg-gray-200">
            <X size={20} />
          </button>
        </div>

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
                      feedType === opt.value
                        ? "bg-feed text-white border-feed"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {(feedType === "formula" || feedType === "bottle") ? (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (ml)</label>
                <input
                  type="number"
                  value={amountMl}
                  onChange={(e) => setAmountMl(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-feed"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-feed"
                />
              </div>
            )}
          </>
        )}

        {/* Sleep */}
        {type === "sleep" && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Duration (minutes, optional)</label>
            <input
              type="number"
              value={sleepDuration}
              onChange={(e) => setSleepDuration(e.target.value)}
              placeholder="Leave blank if still sleeping"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep"
            />
          </div>
        )}

        {/* Medication */}
        {type === "medication" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Medication name *</label>
              <input
                type="text"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="e.g. Calpol"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-medication"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">Dose *</label>
                <input
                  type="number"
                  value={medDose}
                  onChange={(e) => setMedDose(e.target.value)}
                  placeholder="e.g. 2.5"
                  step="0.5"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-medication"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-gray-600 mb-1">Unit</label>
                <select
                  value={medUnit}
                  onChange={(e) => setMedUnit(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-medication bg-white"
                >
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
                  <button
                    key={opt.value}
                    onClick={() => setNappyType(opt.value)}
                    className={`rounded-xl p-3 text-sm font-medium border-2 transition-colors ${
                      nappyType === opt.value
                        ? "bg-nappy text-white border-nappy"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Colour (optional)</label>
              <input
                type="text"
                value={nappyColor}
                onChange={(e) => setNappyColor(e.target.value)}
                placeholder="e.g. yellow, green"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-nappy"
              />
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra notes..."
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={loading}
          className={`w-full ${colorButton[type]} text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform`}
        >
          {loading ? "Saving..." : `Save ${activityLabel(type)}`}
        </button>
      </div>
    </div>
  );
}
