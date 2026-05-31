"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel, timeAgo, preciseTimeAgo, summariseActivity, formatDateTime, isSleeping, sleepDurationMin } from "@/lib/helpers";
import LogModal from "@/components/LogModal";
import { ArrowLeft, Plus, Pencil, ChevronDown } from "lucide-react";
import {
  differenceInMinutes, format, isToday, isYesterday,
  subDays, startOfDay, eachDayOfInterval,
} from "date-fns";

const VALID_TYPES: ActivityType[] = ["feed", "sleep", "medication", "nappy"];

function det(a: Activity): Record<string, unknown> {
  return a.details as unknown as Record<string, unknown>;
}

function isAlert(last: Activity | undefined, type: ActivityType): boolean {
  if (!last) return false;
  const mins = differenceInMinutes(new Date(), new Date(last.logged_at));
  if (type === "feed") return mins > 180;
  if (type === "medication") return mins > 720;
  return false;
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMM");
}

function groupByDate(activities: Activity[]): { label: string; key: string; items: Activity[] }[] {
  const groups = new Map<string, Activity[]>();
  for (const a of activities) {
    const key = format(new Date(a.logged_at), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: dateLabel(key + "T12:00:00"),
    items,
  }));
}

function dayTotal(items: Activity[], type: ActivityType): string {
  if (type === "feed") {
    const ml = items.reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0);
    const feeds = items.length;
    return ml > 0 ? `${ml} ml · ${feeds} feed${feeds !== 1 ? "s" : ""}` : `${feeds} feed${feeds !== 1 ? "s" : ""}`;
  }
  if (type === "sleep") {
    const mins = items.reduce((s, a) => s + (Number(det(a).duration_min) || 0), 0);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m · ${items.length} naps`;
    return mins > 0 ? `${mins} min · ${items.length} naps` : `${items.length} sleep${items.length !== 1 ? "s" : ""}`;
  }
  if (type === "medication") return `${items.length} dose${items.length !== 1 ? "s" : ""}`;
  if (type === "nappy") {
    const wet = items.filter(a => (det(a).nappy_type as string) === "wet").length;
    const dirty = items.filter(a => ["dirty", "both"].includes(det(a).nappy_type as string)).length;
    return `${items.length} changes · ${wet} wet · ${dirty} dirty`;
  }
  return `${items.length} entries`;
}

const accentText: Record<ActivityType, string> = {
  feed: "text-feed-dark", sleep: "text-sleep-dark",
  medication: "text-medication-dark", nappy: "text-nappy-dark",
};
const barColor: Record<ActivityType, string> = {
  feed: "bg-feed", sleep: "bg-sleep", medication: "bg-medication", nappy: "bg-nappy",
};
const borderColor: Record<ActivityType, string> = {
  feed: "border-l-feed", sleep: "border-l-sleep",
  medication: "border-l-medication", nappy: "border-l-nappy",
};

// Simple 7-day bar chart
function BarChart({ activities, type }: { activities: Activity[]; type: ActivityType }) {
  const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });

  const values = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayItems = activities.filter(a => format(new Date(a.logged_at), "yyyy-MM-dd") === dayStr);
    if (type === "feed") return dayItems.reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0);
    if (type === "sleep") return dayItems.reduce((s, a) => s + (Number(det(a).duration_min) || 0), 0);
    return dayItems.length;
  });

  const max = Math.max(...values, 1);

  function label(v: number): string {
    if (type === "feed") return v > 0 ? `${v}` : "";
    if (type === "sleep") return v >= 60 ? `${Math.floor(v / 60)}h` : v > 0 ? `${v}m` : "";
    return v > 0 ? `${v}` : "";
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Last 7 days</p>
      <div className="flex items-end gap-1.5 h-20">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-gray-400 font-medium">{label(values[i])}</span>
            <div className="w-full rounded-t-md transition-all"
              style={{ height: `${Math.max((values[i] / max) * 52, values[i] > 0 ? 4 : 0)}px` }}
            >
              <div className={`w-full h-full rounded-t-md ${isToday(day) ? barColor[type] : barColor[type] + " opacity-40"}`} />
            </div>
            <span className={`text-[9px] font-medium ${isToday(day) ? "text-gray-700" : "text-gray-300"}`}>
              {format(day, "EEE")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const router = useRouter();
  const params = useParams();
  const babyId = params.id as string;
  const type = params.type as ActivityType;

  const [carerId, setCarerId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);   // last 7 days
  const [allActivities, setAllActivities] = useState<Activity[] | null>(null); // full history
  const [loading, setLoading] = useState(true);
  const [sleepToggling, setSleepToggling] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);

  if (!VALID_TYPES.includes(type)) router.replace("/");

  const sevenDaysAgo = startOfDay(subDays(new Date(), 6)).toISOString();

  const fetchRecent = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }

    const [{ data: carer }, { data: baby }, { data: acts }] = await Promise.all([
      supabase.from("carers").select("id").eq("baby_id", babyId).eq("user_id", user.id).single(),
      supabase.from("babies").select("name").eq("id", babyId).single(),
      supabase.from("activities").select("*, carers(name)")
        .eq("baby_id", babyId).eq("type", type)
        .gte("logged_at", sevenDaysAgo)
        .order("logged_at", { ascending: false }),
    ]);

    if (!carer) { router.replace("/"); return; }
    setCarerId(carer.id);
    if (baby) setBabyName(baby.name);
    if (acts) {
      setActivities(acts.map((a: Activity & { carers?: { name: string } }) => ({
        ...a, carer_name: a.carers?.name ?? "Unknown",
      })));
    }
    setLoading(false);
  }, [babyId, type, router, sevenDaysAgo]);

  async function loadMore() {
    setLoadingMore(true);
    const { data: acts } = await supabase.from("activities").select("*, carers(name)")
      .eq("baby_id", babyId).eq("type", type)
      .lt("logged_at", sevenDaysAgo)
      .order("logged_at", { ascending: false });
    if (acts) {
      const mapped = acts.map((a: Activity & { carers?: { name: string } }) => ({
        ...a, carer_name: a.carers?.name ?? "Unknown",
      }));
      setAllActivities(mapped);
    }
    setLoadingMore(false);
  }

  async function toggleSleep() {
    if (!carerId) return;
    setSleepToggling(true);
    const last = activities[0];
    const sleeping = isSleeping(last);
    try {
      if (sleeping && last) {
        const d = last.details as unknown as Record<string, unknown>;
        const endTime = new Date().toISOString();
        const duration = sleepDurationMin(d.start_time as string, endTime);
        await supabase.from("activities").update({
          details: { ...d, end_time: endTime, duration_min: duration },
        }).eq("id", last.id);
      } else {
        await supabase.from("activities").insert({
          baby_id: babyId, carer_id: carerId, type: "sleep",
          details: { start_time: new Date().toISOString() },
          logged_at: new Date().toISOString(),
        });
      }
      await fetchRecent();
    } finally {
      setSleepToggling(false);
    }
  }

  useEffect(() => {
    fetchRecent();
    const channel = supabase.channel(`act-${babyId}-${type}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities",
        filter: `baby_id=eq.${babyId}` }, fetchRecent)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [babyId, type, fetchRecent]);

  // Open log modal immediately if directed via ?new=1
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "1") setShowLog(true);
    }
  }, []);

  const last = activities[0];
  const alert = isAlert(last, type);
  const todayActs = activities.filter((a) => isToday(new Date(a.logged_at)));

  function dailySummary(): string {
    if (type === "feed") {
      const ml = todayActs.reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0);
      return ml > 0 ? `${ml} ml` : `${todayActs.length} feeds`;
    }
    if (type === "sleep") {
      const mins = todayActs.reduce((s, a) => s + (Number(det(a).duration_min) || 0), 0);
      if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      return mins > 0 ? `${mins} min` : `${todayActs.length} sleeps`;
    }
    if (type === "medication") return `${todayActs.length} dose${todayActs.length !== 1 ? "s" : ""}`;
    if (type === "nappy") return `${todayActs.length} change${todayActs.length !== 1 ? "s" : ""}`;
    return "";
  }

  const displayActivities = allActivities ? [...activities, ...allActivities] : activities;
  const grouped = groupByDate(displayActivities);

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
          <h1 className="text-2xl font-bold">{activityEmoji(type)} {activityLabel(type)}</h1>
          <p className="text-white/70 text-sm">{babyName}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Sleep: special toggle UI */}
        {type === "sleep" ? (() => {
          const sleeping = isSleeping(last);
          const d = last ? (last.details as unknown as Record<string, unknown>) : null;
          const elapsed = sleeping && d ? differenceInMinutes(new Date(), new Date(d.start_time as string)) : null;
          const todaySleepMins = todayActs.filter(a => (a.details as unknown as Record<string,unknown>).duration_min)
            .reduce((s, a) => s + Number((a.details as unknown as Record<string,unknown>).duration_min), 0);
          return (
            <div className="space-y-3">
              {/* State card */}
              <div className={`rounded-2xl p-5 border-l-4 border-l-sleep shadow-sm ${sleeping ? "bg-sleep/5" : "bg-white"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-3xl font-bold text-gray-800">{sleeping ? "😴 Sleeping" : "☀️ Awake"}</p>
                    {sleeping && elapsed !== null && (
                      <p className="text-xl text-sleep-dark font-semibold mt-1">
                        {elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`} so far
                      </p>
                    )}
                    {!sleeping && last && d?.duration_min != null && (
                      <p className="text-sm text-gray-500 mt-1">
                        Last sleep: {(() => { const m = Number(d.duration_min); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; })()} · {timeAgo(last.logged_at)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Today</p>
                    <p className="text-xl font-bold text-sleep-dark mt-1">
                      {todaySleepMins >= 60 ? `${Math.floor(todaySleepMins/60)}h ${todaySleepMins%60}m` : todaySleepMins > 0 ? `${todaySleepMins}m` : "—"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleSleep}
                  disabled={sleepToggling}
                  className={`w-full rounded-2xl py-4 text-lg font-semibold text-white active:opacity-80 disabled:opacity-50 transition-colors ${sleeping ? "bg-amber-400" : "bg-sleep"}`}
                >
                  {sleepToggling ? "Please wait..." : sleeping ? "☀️ Baby woke up — mark awake" : "😴 Baby fell asleep — mark asleep"}
                </button>
              </div>
              {/* Manual log option */}
              <button onClick={() => setShowLog(true)}
                className="w-full bg-white border-2 border-dashed border-gray-200 rounded-2xl p-3 flex items-center justify-center gap-2 text-gray-400 hover:border-sleep hover:text-sleep active:bg-gray-50 transition-colors text-sm">
                <Plus size={16} />
                <span className="font-medium">Manually log a past sleep</span>
              </button>
            </div>
          );
        })() : (
          <>
            {/* Non-sleep summary card */}
            <div className={`rounded-2xl p-4 border-l-4 ${borderColor[type]} shadow-sm ${alert ? "bg-red-50" : "bg-white"}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-500 text-sm uppercase tracking-wide">Last {activityLabel(type)}</p>
                {alert && (
                  <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-1 rounded-full">
                    {type === "feed" ? "Over 3 hours!" : "Over 12 hours!"}
                  </span>
                )}
              </div>
              {last ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-gray-800"}`}>
                      {type === "feed" ? preciseTimeAgo(last.logged_at) : timeAgo(last.logged_at)}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{summariseActivity(last)}</p>
                    {type === "feed" && det(last).amount_ml != null && (
                      <p className={`text-sm font-semibold mt-0.5 ${accentText[type]}`}>{String(det(last).amount_ml)} ml</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">by {last.carer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Today</p>
                    <p className={`text-2xl font-bold mt-1 ${accentText[type]}`}>{dailySummary()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{todayActs.length} entr{todayActs.length !== 1 ? "ies" : "y"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">No {activityLabel(type).toLowerCase()} logged yet</p>
              )}
            </div>
            {/* Add new log button */}
            <button onClick={() => setShowLog(true)}
              className="w-full bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 hover:border-sleep hover:text-sleep active:bg-gray-50 transition-colors">
              <Plus size={20} />
              <span className="font-semibold">Log new {activityLabel(type).toLowerCase()}</span>
            </button>
          </>
        )}

        {/* 7-day bar chart */}
        <BarChart activities={activities} type={type} />

        {/* Logs grouped by date */}
        {grouped.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
            <p className="text-3xl mb-2">{activityEmoji(type)}</p>
            <p>No {activityLabel(type).toLowerCase()} entries yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Date header with daily total */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className={`text-xs font-semibold ${accentText[type]}`}>{dayTotal(items, type)}</p>
                </div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <div key={a.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                      <span className="text-2xl">{activityEmoji(a.type)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-800">{summariseActivity(a)}</span>
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

            {/* Load more */}
            {!allActivities && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full bg-white rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 shadow-sm active:bg-gray-50 disabled:opacity-50">
                <ChevronDown size={18} />
                <span className="text-sm font-medium">{loadingMore ? "Loading..." : "Load older entries"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showLog && carerId && (
        <LogModal type={type} babyId={babyId} carerId={carerId}
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); fetchRecent(); }} />
      )}
      {editActivity && carerId && (
        <LogModal type={type} babyId={babyId} carerId={carerId} existing={editActivity}
          onClose={() => setEditActivity(null)}
          onSaved={() => { setEditActivity(null); fetchRecent(); }} />
      )}
    </div>
  );
}
