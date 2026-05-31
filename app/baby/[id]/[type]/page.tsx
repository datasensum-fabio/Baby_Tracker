"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel, timeAgo, preciseTimeAgo, summariseActivity, formatDateTime } from "@/lib/helpers";
import LogModal from "@/components/LogModal";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { differenceInMinutes, format, isToday, isYesterday } from "date-fns";

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

function groupByDate(activities: Activity[]): { label: string; items: Activity[] }[] {
  const groups = new Map<string, Activity[]>();
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

const borderColor: Record<ActivityType, string> = {
  feed: "border-l-feed",
  sleep: "border-l-sleep",
  medication: "border-l-medication",
  nappy: "border-l-nappy",
};

const accentText: Record<ActivityType, string> = {
  feed: "text-feed-dark",
  sleep: "text-sleep-dark",
  medication: "text-medication-dark",
  nappy: "text-nappy-dark",
};

export default function ActivityPage() {
  const router = useRouter();
  const params = useParams();
  const babyId = params.id as string;
  const type = params.type as ActivityType;

  const [carerId, setCarerId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);

  if (!VALID_TYPES.includes(type)) {
    router.replace("/");
  }

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }

    const [{ data: carer }, { data: baby }, { data: acts }] = await Promise.all([
      supabase.from("carers").select("id").eq("baby_id", babyId).eq("user_id", user.id).single(),
      supabase.from("babies").select("name").eq("id", babyId).single(),
      supabase.from("activities").select("*, carers(name)")
        .eq("baby_id", babyId).eq("type", type)
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
  }, [babyId, type, router]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel(`act-${babyId}-${type}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `baby_id=eq.${babyId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [babyId, type, fetchData]);

  const last = activities[0];
  const alert = isAlert(last, type);
  const todayActs = activities.filter((a) => isToday(new Date(a.logged_at)));

  function dailySummary(): string {
    if (type === "feed") {
      const ml = todayActs.reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0);
      return ml > 0 ? `${ml} ml` : `${todayActs.length} feed${todayActs.length !== 1 ? "s" : ""}`;
    }
    if (type === "sleep") {
      const mins = todayActs.reduce((s, a) => s + (Number(det(a).duration_min) || 0), 0);
      if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      return mins > 0 ? `${mins} min` : `${todayActs.length} sleep${todayActs.length !== 1 ? "s" : ""}`;
    }
    if (type === "medication") return `${todayActs.length} dose${todayActs.length !== 1 ? "s" : ""}`;
    if (type === "nappy") return `${todayActs.length} change${todayActs.length !== 1 ? "s" : ""}`;
    return "";
  }

  const grouped = groupByDate(activities);

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
        {/* Summary card */}
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
        <button
          onClick={() => setShowLog(true)}
          className="w-full bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 hover:border-sleep hover:text-sleep active:bg-gray-50 transition-colors"
        >
          <Plus size={20} />
          <span className="font-semibold">Log new {activityLabel(type).toLowerCase()}</span>
        </button>

        {/* All logs grouped by date */}
        {grouped.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
            <p className="text-3xl mb-2">{activityEmoji(type)}</p>
            <p>No {activityLabel(type).toLowerCase()} entries yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  {label === "Today" && type === "feed" && (
                    <p className={`text-xs font-semibold ${accentText[type]}`}>
                      {items.reduce((s, a) => s + (Number(det(a).amount_ml) || 0), 0)} ml total
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <div key={a.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                      <span className="text-2xl">{activityEmoji(a.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-gray-800">{summariseActivity(a)}</span>
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

      {showLog && carerId && (
        <LogModal type={type} babyId={babyId} carerId={carerId}
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); fetchData(); }} />
      )}
      {editActivity && carerId && (
        <LogModal type={type} babyId={babyId} carerId={carerId} existing={editActivity}
          onClose={() => setEditActivity(null)}
          onSaved={() => { setEditActivity(null); fetchData(); }} />
      )}
    </div>
  );
}
