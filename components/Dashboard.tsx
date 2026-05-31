"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType, Baby, Carer } from "@/lib/types";
import { activityEmoji, activityLabel, timeAgo, summariseActivity, formatDateTime } from "@/lib/helpers";
import LogModal from "./LogModal";
import ShareModal from "./ShareModal";
import { Share2, RefreshCw } from "lucide-react";
import { differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";

const ACTIVITY_TYPES: ActivityType[] = ["feed", "sleep", "medication", "nappy"];

const buttonStyle: Record<ActivityType, string> = {
  feed: "bg-feed hover:bg-feed-dark active:bg-feed-dark",
  sleep: "bg-sleep hover:bg-sleep-dark active:bg-sleep-dark",
  medication: "bg-medication hover:bg-medication-dark active:bg-medication-dark",
  nappy: "bg-nappy hover:bg-nappy-dark active:bg-nappy-dark",
};

const cardBorder: Record<ActivityType, string> = {
  feed: "border-l-feed",
  sleep: "border-l-sleep",
  medication: "border-l-medication",
  nappy: "border-l-nappy",
};

export default function Dashboard() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [carer, setCarer] = useState<Carer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logType, setLogType] = useState<ActivityType | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [loading, setLoading] = useState(true);

  const babyId = typeof window !== "undefined" ? localStorage.getItem("baby_id") : null;
  const carerId = typeof window !== "undefined" ? localStorage.getItem("carer_id") : null;

  const fetchData = useCallback(async () => {
    if (!babyId || !carerId) return;
    const [{ data: babyData }, { data: carerData }, { data: actData }] = await Promise.all([
      supabase.from("babies").select().eq("id", babyId).single(),
      supabase.from("carers").select().eq("id", carerId).single(),
      supabase
        .from("activities")
        .select("*, carers(name)")
        .eq("baby_id", babyId)
        .order("logged_at", { ascending: false })
        .limit(50),
    ]);
    if (babyData) setBaby(babyData);
    if (carerData) setCarer(carerData);
    if (actData) {
      setActivities(
        actData.map((a: Activity & { carers?: { name: string } }) => ({
          ...a,
          carer_name: a.carers?.name ?? "Unknown",
        }))
      );
    }
    setLoading(false);
  }, [babyId, carerId]);

  useEffect(() => {
    fetchData();
    if (!babyId) return;
    const channel = supabase
      .channel("activities")
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `baby_id=eq.${babyId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [babyId, fetchData]);

  function lastOf(type: ActivityType): Activity | undefined {
    return activities.find((a) => a.type === type);
  }

  function babyAge(): string {
    if (!baby?.birth_date) return "";
    const dob = new Date(baby.birth_date);
    const months = differenceInMonths(new Date(), dob);
    if (months >= 3) return `${months} months old`;
    const weeks = differenceInWeeks(new Date(), dob);
    if (weeks >= 1) return `${weeks} weeks old`;
    const days = differenceInDays(new Date(), dob);
    return `${days} days old`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-bounce">👶</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-sleep to-feed px-5 pt-10 pb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{baby?.name ?? "Baby"} 👶</h1>
            {baby?.birth_date && <p className="text-white/80 text-sm mt-0.5">{babyAge()}</p>}
            <p className="text-white/70 text-sm mt-1">Hi, {carer?.name} ({carer?.role})</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2 bg-white/20 rounded-full active:bg-white/30">
              <RefreshCw size={18} />
            </button>
            <button onClick={() => setShowShare(true)} className="p-2 bg-white/20 rounded-full active:bg-white/30">
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Last activity summary */}
        <div className="grid grid-cols-2 gap-3">
          {ACTIVITY_TYPES.map((type) => {
            const last = lastOf(type);
            return (
              <div key={type} className={`bg-white rounded-2xl p-3 border-l-4 shadow-sm ${cardBorder[type]}`}>
                <p className="text-lg font-bold">{activityEmoji(type)} {activityLabel(type)}</p>
                {last ? (
                  <>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(last.logged_at)}</p>
                    <p className="text-sm text-gray-700 mt-0.5 truncate">{summariseActivity(last)}</p>
                    <p className="text-xs text-gray-400">by {last.carer_name}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No record yet</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Log buttons */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Log an activity</p>
          <div className="grid grid-cols-2 gap-3">
            {ACTIVITY_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setLogType(type)}
                className={`${buttonStyle[type]} text-white rounded-2xl p-4 flex items-center gap-3 shadow active:scale-95 transition-transform`}
              >
                <span className="text-2xl">{activityEmoji(type)}</span>
                <span className="text-lg font-semibold">{activityLabel(type)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Activity log */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent activity</p>
          {activities.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <p className="text-3xl mb-2">📋</p>
              <p>No activities logged yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 20).map((a) => (
                <div key={a.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <span className="text-2xl">{activityEmoji(a.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-gray-800">{activityLabel(a.type)}</span>
                      <span className="text-sm text-gray-500 truncate">{summariseActivity(a)}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(a.logged_at)} · {a.carer_name}
                    </p>
                    {a.notes && <p className="text-xs text-gray-500 italic mt-0.5">{a.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {logType && (
        <LogModal
          type={logType}
          onClose={() => setLogType(null)}
          onSaved={() => { setLogType(null); fetchData(); }}
        />
      )}
      {showShare && baby && <ShareModal code={baby.code} onClose={() => setShowShare(false)} />}
    </div>
  );
}
