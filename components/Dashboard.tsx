"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType, Baby, Carer } from "@/lib/types";
import { activityEmoji, activityLabel, timeAgo, preciseTimeAgo, summariseActivity, formatDateTime, isSleeping, sleepDurationMin } from "@/lib/helpers";
import LogModal from "./LogModal";
import ShareModal from "./ShareModal";
import InstallBanner from "./InstallBanner";
import { Share2, RefreshCw, Pencil, ArrowLeft, Trash2 } from "lucide-react";
import {
  differenceInMinutes, differenceInDays, differenceInWeeks, differenceInMonths,
  format, isToday, isYesterday,
} from "date-fns";


function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMM");
}

function groupByDate(activities: Activity[]): { label: string; items: Activity[] }[] {
  const groups: Map<string, Activity[]> = new Map();
  for (const a of activities) {
    const key = format(new Date(a.logged_at), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    label: dateLabel(key + "T12:00:00"),
    items,
  }));
}

function det(a: Activity): Record<string, unknown> {
  return a.details as unknown as Record<string, unknown>;
}

function dailyTotal(activities: Activity[], type: ActivityType): string {
  const today = activities.filter((a) => a.type === type && isToday(new Date(a.logged_at)));
  if (type === "feed") {
    const ml = today.reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0);
    return ml > 0 ? `${ml} ml today` : `${today.length} feed${today.length !== 1 ? "s" : ""} today`;
  }
  if (type === "sleep") {
    const mins = today.reduce((s, a) => s + (Number(det(a).duration_min) || 0), 0);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m today`;
    return mins > 0 ? `${mins} min today` : "";
  }
  if (type === "medication") {
    return today.length > 0 ? `${today.length} dose${today.length !== 1 ? "s" : ""} today` : "";
  }
  if (type === "nappy") {
    return today.length > 0 ? `${today.length} change${today.length !== 1 ? "s" : ""} today` : "";
  }
  return "";
}

function isAlert(last: Activity | undefined, type: ActivityType): boolean {
  if (!last) return false;
  const mins = differenceInMinutes(new Date(), new Date(last.logged_at));
  if (type === "feed") return mins > 180;       // > 3 hours
  if (type === "medication") return mins > 720; // > 12 hours
  return false;
}

interface Props { babyId: string; carerId: string; }

export default function Dashboard({ babyId, carerId }: Props) {
  const router = useRouter();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [carer, setCarer] = useState<Carer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logType, setLogType] = useState<ActivityType | null>(null);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sleepToggling, setSleepToggling] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: babyData }, { data: carerData }, { data: actData }] = await Promise.all([
      supabase.from("babies").select().eq("id", babyId).single(),
      supabase.from("carers").select().eq("id", carerId).single(),
      supabase.from("activities").select("*, carers(name)")
        .eq("baby_id", babyId).is("deleted_at", null).order("logged_at", { ascending: false }).limit(200),
    ]);
    if (babyData) setBaby(babyData);
    if (carerData) setCarer(carerData);
    if (actData) {
      setActivities(actData.map((a: Activity & { carers?: { name: string } }) => ({
        ...a, carer_name: a.carers?.name ?? "Unknown",
      })));
    }
    setLoading(false);
  }, [babyId, carerId]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel(`activities-${babyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `baby_id=eq.${babyId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [babyId, fetchData]);

  function lastOf(type: ActivityType): Activity | undefined {
    return activities.find((a) => a.type === type);
  }

  async function toggleSleep() {
    setSleepToggling(true);
    const last = activities.find((a) => a.type === "sleep");
    const sleeping = isSleeping(last);
    try {
      if (sleeping && last) {
        // Mark awake: close the active sleep session
        const d = last.details as unknown as Record<string, unknown>;
        const endTime = new Date().toISOString();
        const duration = sleepDurationMin(d.start_time as string, endTime);
        await supabase.from("activities").update({
          details: { ...d, end_time: endTime, duration_min: duration },
        }).eq("id", last.id);
      } else {
        // Mark asleep: create new sleep activity
        await supabase.from("activities").insert({
          baby_id: babyId, carer_id: carerId, type: "sleep",
          details: { start_time: new Date().toISOString() },
          logged_at: new Date().toISOString(),
        });
      }
      await fetchData();
    } finally {
      setSleepToggling(false);
    }
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
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-bounce">👶</div></div>;
  }

  const grouped = groupByDate(activities);
  const lastFeed = lastOf("feed");
  const lastSleep = lastOf("sleep");
  const lastMed = lastOf("medication");
  const lastNappy = lastOf("nappy");
  const feedAlert = isAlert(lastFeed, "feed");
  const medAlert = isAlert(lastMed, "medication");

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-sleep to-feed px-5 pt-10 pb-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="p-2 bg-white/20 rounded-full active:bg-white/30">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{baby?.name ?? "Baby"} 👶</h1>
              {baby?.birth_date && <p className="text-white/80 text-sm mt-0.5">{babyAge()}</p>}
              <p className="text-white/70 text-sm mt-0.5">Hi, {carer?.name} ({carer?.role})</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2 bg-white/20 rounded-full active:bg-white/30"><RefreshCw size={18} /></button>
            <button onClick={() => setShowShare(true)} className="p-2 bg-white/20 rounded-full active:bg-white/30"><Share2 size={18} /></button>
            <button onClick={() => router.push(`/baby/${babyId}/deleted`)} className="p-2 bg-white/20 rounded-full active:bg-white/30"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Summary cards */}
        <div className="space-y-3">

          {/* FEED — full-width, big, clickable */}
          <button
            onClick={() => router.push(`/baby/${babyId}/feed`)}
            className={`w-full text-left rounded-2xl p-4 border-l-4 border-l-feed shadow-sm transition-colors active:scale-[0.99] ${feedAlert ? "bg-red-50" : "bg-white"}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold flex items-center gap-2">🍼 Feed</p>
              {feedAlert && <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-1 rounded-full">Over 3 hours!</span>}
            </div>
            {lastFeed ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Last feed</p>
                  <p className={`text-2xl font-bold mt-0.5 ${feedAlert ? "text-red-600" : "text-gray-800"}`}>
                    {preciseTimeAgo(lastFeed.logged_at)}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{summariseActivity(lastFeed)}</p>
                  {det(lastFeed).amount_ml != null && (
                    <p className="text-sm font-semibold text-feed-dark mt-0.5">{String(det(lastFeed).amount_ml)} ml</p>
                  )}
                  <p className="text-xs text-gray-400">by {lastFeed.carer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Today</p>
                  <p className="text-2xl font-bold text-gray-700 mt-0.5">
                    {activities.filter(a => a.type === "feed" && isToday(new Date(a.logged_at)))
                      .reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0)} ml
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activities.filter(a => a.type === "feed" && isToday(new Date(a.logged_at))).length} feeds
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-1">No feed logged yet</p>
            )}
          </button>

          {/* SLEEP + NAPPY — 2 col */}
          <div className="grid grid-cols-2 gap-3">
            {/* Sleep — state toggle card */}
            {(() => {
              const sleeping = isSleeping(lastSleep);
              const d = lastSleep ? (lastSleep.details as unknown as Record<string, unknown>) : null;
              const elapsed = sleeping && d ? differenceInMinutes(new Date(), new Date(d.start_time as string)) : null;
              return (
                <div className={`rounded-2xl p-3 border-l-4 border-l-sleep shadow-sm flex flex-col gap-2 ${sleeping ? "bg-sleep/5" : "bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{sleeping ? "😴 Sleeping" : "☀️ Awake"}</p>
                    <button onClick={() => router.push(`/baby/${babyId}/sleep`)}
                      className="text-[10px] text-gray-400 underline">history</button>
                  </div>
                  {sleeping && elapsed !== null ? (
                    <p className="text-lg font-bold text-sleep-dark">
                      {elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`}
                    </p>
                  ) : lastSleep && !sleeping && d?.duration_min ? (
                    <p className="text-sm text-gray-500">Last: {(() => { const m = Number(d.duration_min); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; })()}</p>
                  ) : null}
                  {dailyTotal(activities, "sleep") && (
                    <p className="text-xs font-semibold text-sleep-dark">{dailyTotal(activities, "sleep")}</p>
                  )}
                  <button
                    onClick={toggleSleep}
                    disabled={sleepToggling}
                    className={`w-full rounded-xl py-2 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50 transition-colors ${sleeping ? "bg-amber-400" : "bg-sleep"}`}
                  >
                    {sleepToggling ? "..." : sleeping ? "☀️ Baby woke up" : "😴 Baby fell asleep"}
                  </button>
                </div>
              );
            })()}
            {/* Nappy */}
            <button onClick={() => router.push(`/baby/${babyId}/nappy`)}
              className="bg-white rounded-2xl p-3 border-l-4 border-l-nappy shadow-sm text-left active:scale-[0.98]">
              <p className="font-bold flex items-center gap-1">🩲 Nappy</p>
              {lastNappy ? (
                <>
                  <p className="text-xs text-gray-500 mt-1">{timeAgo(lastNappy.logged_at)}</p>
                  <p className="text-sm text-gray-700 truncate">{summariseActivity(lastNappy)}</p>
                  <p className="text-xs text-gray-400">by {lastNappy.carer_name}</p>
                  {dailyTotal(activities, "nappy") && (
                    <p className="text-xs font-semibold text-nappy-dark mt-1">{dailyTotal(activities, "nappy")}</p>
                  )}
                </>
              ) : <p className="text-xs text-gray-400 mt-1">No record yet</p>}
            </button>
          </div>

          {/* MEDICATION — full width, clickable */}
          <button
            onClick={() => router.push(`/baby/${babyId}/medication`)}
            className={`w-full text-left rounded-2xl p-4 border-l-4 border-l-medication shadow-sm transition-colors active:scale-[0.99] ${medAlert ? "bg-red-50" : "bg-white"}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">💊 Medication</p>
              {medAlert && <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-1 rounded-full">Over 12 hours!</span>}
            </div>
            {lastMed ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Last dose</p>
                  <p className={`text-2xl font-bold mt-0.5 ${medAlert ? "text-red-600" : "text-gray-800"}`}>
                    {timeAgo(lastMed.logged_at)}
                  </p>
                  <p className="text-sm text-gray-500">{summariseActivity(lastMed)}</p>
                  <p className="text-xs text-gray-400">by {lastMed.carer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Today</p>
                  <p className="text-2xl font-bold text-gray-700 mt-0.5">
                    {activities.filter(a => a.type === "medication" && isToday(new Date(a.logged_at))).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">doses</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-1">No medication logged yet</p>
            )}
          </button>
        </div>

        {/* Log an activity */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Log an activity</p>
          <div className="grid grid-cols-2 gap-3">
            {(["feed", "sleep", "medication", "nappy"] as ActivityType[]).map((t) => (
              <button key={t} onClick={() => setLogType(t)}
                className={{
                  feed: "bg-feed hover:bg-feed-dark active:bg-feed-dark",
                  sleep: "bg-sleep hover:bg-sleep-dark active:bg-sleep-dark",
                  medication: "bg-medication hover:bg-medication-dark active:bg-medication-dark",
                  nappy: "bg-nappy hover:bg-nappy-dark active:bg-nappy-dark",
                }[t] + " text-white rounded-2xl p-4 flex items-center gap-3 shadow active:scale-95 transition-transform"}>
                <span className="text-2xl">{activityEmoji(t)}</span>
                <span className="text-lg font-semibold">{activityLabel(t)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Activity log grouped by date */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Activity log</p>
          {grouped.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <p className="text-3xl mb-2">📋</p><p>No activities logged yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{label}</p>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                        <span className="text-2xl">{activityEmoji(a.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-gray-800">{activityLabel(a.type)}</span>
                            <span className="text-sm text-gray-500 truncate">{summariseActivity(a)}</span>
                          </div>
                          <p className="text-xs text-gray-400">{formatDateTime(a.logged_at)} · {a.carer_name}</p>
                          {a.notes && <p className="text-xs text-gray-500 italic mt-0.5">{a.notes}</p>}
                        </div>
                        <button onClick={() => setEditActivity(a)}
                          className="p-2 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 active:bg-gray-200 flex-shrink-0">
                          <Pencil size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {logType && (
        <LogModal type={logType} babyId={babyId} carerId={carerId}
          onClose={() => setLogType(null)} onSaved={() => { setLogType(null); fetchData(); }} />
      )}
      {editActivity && (
        <LogModal type={editActivity.type} babyId={babyId} carerId={carerId} existing={editActivity}
          onClose={() => setEditActivity(null)} onSaved={() => { setEditActivity(null); fetchData(); }} />
      )}
      {showShare && baby && <ShareModal code={baby.code} babyName={baby.name} onClose={() => setShowShare(false)} />}
      <InstallBanner />
    </div>
  );
}
