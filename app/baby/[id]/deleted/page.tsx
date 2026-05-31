"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityType } from "@/lib/types";
import { activityEmoji, activityLabel, summariseActivity, formatDateTime } from "@/lib/helpers";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_LABELS: Record<ActivityType, string> = {
  feed: "bg-feed/10 text-feed-dark",
  sleep: "bg-sleep/10 text-sleep-dark",
  medication: "bg-medication/10 text-medication-dark",
  nappy: "bg-nappy/10 text-nappy-dark",
};

export default function DeletedLogsPage() {
  const router = useRouter();
  const params = useParams();
  const babyId = params.id as string;

  const [babyName, setBabyName] = useState("");
  const [deleted, setDeleted] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permDeleting, setPermDeleting] = useState<string | null>(null);
  const [confirmPerm, setConfirmPerm] = useState<string | null>(null);

  const fetchDeleted = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }

    const [{ data: carer }, { data: baby }, { data: acts }] = await Promise.all([
      supabase.from("carers").select("id").eq("baby_id", babyId).eq("user_id", user.id).single(),
      supabase.from("babies").select("name").eq("id", babyId).single(),
      supabase.from("activities")
        .select("*, carers(name)")
        .eq("baby_id", babyId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

    if (!carer) { router.replace("/"); return; }
    if (baby) setBabyName(baby.name);
    if (acts) {
      setDeleted(acts.map((a: Activity & { carers?: { name: string } }) => ({
        ...a, carer_name: a.carers?.name ?? "Unknown",
      })));
    }
    setLoading(false);
  }, [babyId, router]);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);

  async function restore(id: string) {
    setRestoring(id);
    await supabase.from("activities").update({ deleted_at: null }).eq("id", id);
    setDeleted((prev) => prev.filter((a) => a.id !== id));
    setRestoring(null);
  }

  async function permDelete(id: string) {
    setPermDeleting(id);
    await supabase.from("activities").delete().eq("id", id);
    setDeleted((prev) => prev.filter((a) => a.id !== id));
    setPermDeleting(null);
    setConfirmPerm(null);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-bounce">👶</div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-800 px-5 pt-10 pb-6 text-white flex items-center gap-3">
        <button onClick={() => router.push(`/baby/${babyId}`)} className="p-2 bg-white/20 rounded-full active:bg-white/30 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">🗑️ Deleted logs</h1>
          <p className="text-white/70 text-sm">{babyName}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-3">
        {deleted.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <p className="text-4xl mb-3">🗑️</p>
            <p className="text-gray-500 font-medium">No deleted logs</p>
            <p className="text-gray-400 text-sm mt-1">Deleted activities will appear here</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 px-1">
              {deleted.length} deleted entr{deleted.length !== 1 ? "ies" : "y"} · tap Restore to bring them back
            </p>
            {deleted.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                {confirmPerm === a.id ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-700">Permanently delete this? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button onClick={() => permDelete(a.id)} disabled={permDeleting === a.id}
                        className="flex-1 bg-red-500 text-white rounded-xl py-2 font-semibold text-sm disabled:opacity-50">
                        {permDeleting === a.id ? "Deleting..." : "Yes, delete forever"}
                      </button>
                      <button onClick={() => setConfirmPerm(null)}
                        className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 font-semibold text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{activityEmoji(a.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_LABELS[a.type]}`}>
                          {activityLabel(a.type)}
                        </span>
                        <span className="text-sm text-gray-700">{summariseActivity(a)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Logged {formatDateTime(a.logged_at)} by {a.carer_name}
                      </p>
                      <p className="text-xs text-red-400 mt-0.5">
                        Deleted {formatDistanceToNow(new Date((a as Activity & { deleted_at: string }).deleted_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => restore(a.id)} disabled={restoring === a.id}
                        className="flex items-center gap-1 bg-sleep/10 text-sleep-dark rounded-xl px-3 py-1.5 text-sm font-semibold active:bg-sleep/20 disabled:opacity-50">
                        <RotateCcw size={13} />
                        {restoring === a.id ? "..." : "Restore"}
                      </button>
                      <button onClick={() => setConfirmPerm(a.id)}
                        className="flex items-center gap-1 bg-red-50 text-red-400 rounded-xl px-3 py-1.5 text-sm font-medium active:bg-red-100">
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
