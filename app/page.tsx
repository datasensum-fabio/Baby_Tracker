"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";
import { Plus, LogOut, Link, ChevronDown, ChevronUp, X, RotateCcw, Share2, Copy, Check, MessageCircle } from "lucide-react";
import { InstallCard } from "@/components/InstallBanner";

interface BabyEntry {
  carer_id: string;
  baby_id: string;
  baby_name: string;
  birth_date: string | null;
  role: string;
  code: string;
  active: boolean;
}

function babyAge(birth_date: string | null): string {
  if (!birth_date) return "";
  const dob = new Date(birth_date);
  const months = differenceInMonths(new Date(), dob);
  if (months >= 3) return `${months} months old`;
  const weeks = differenceInWeeks(new Date(), dob);
  if (weeks >= 1) return `${weeks} weeks old`;
  const days = differenceInDays(new Date(), dob);
  return `${days} days old`;
}

export default function Home() {
  const router = useRouter();
  const [babies, setBabies] = useState<BabyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [showDelinked, setShowDelinked] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareMode, setShareMode] = useState<"choose" | "app" | "baby">("choose");
  const [selectedBaby, setSelectedBaby] = useState<BabyEntry | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadBabies(userId: string) {
    const { data } = await supabase
      .from("carers")
      .select("id, baby_id, role, active, babies(id, name, birth_date, code)")
      .eq("user_id", userId);

    if (data) {
      setBabies(
        data
          .filter((c) => c.babies)
          .map((c) => {
            const b = c.babies as unknown as { id: string; name: string; birth_date: string | null; code: string };
            return { carer_id: c.id, baby_id: b.id, baby_name: b.name, birth_date: b.birth_date, role: c.role, code: b.code, active: c.active !== false };
          })
      );
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserEmail(user.email ?? "");
      await loadBabies(user.id);
      setLoading(false);
    }
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  async function handleRemove(carerId: string) {
    await supabase.from("carers").update({ active: false }).eq("id", carerId);
    setBabies((prev) => prev.map((b) => b.carer_id === carerId ? { ...b, active: false } : b));
    setConfirmRemove(null);
  }

  async function handleRestore(carerId: string) {
    await supabase.from("carers").update({ active: true }).eq("id", carerId);
    setBabies((prev) => prev.map((b) => b.carer_id === carerId ? { ...b, active: true } : b));
  }

  const active = babies.filter((b) => b.active);
  const delinked = babies.filter((b) => !b.active);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-bounce">👶</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-sleep to-feed px-5 pt-10 pb-6 text-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Baby Tracker 👶</h1>
          <p className="text-white/70 text-sm mt-0.5">{userEmail}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShareMode("choose"); setSelectedBaby(null); setCopied(false); setShowShare(true); }}
            className="p-2 bg-white/20 rounded-full active:bg-white/30">
            <Share2 size={18} />
          </button>
          <button onClick={signOut} className="p-2 bg-white/20 rounded-full active:bg-white/30">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* Active babies */}
        {active.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
            <p className="text-5xl mb-3">👶</p>
            <p className="text-gray-600 font-medium">No babies yet</p>
            <p className="text-gray-400 text-sm mt-1">Add your baby or join with a code</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your babies</p>
            {active.map((b) => (
              <div key={b.carer_id} className="relative">
                {/* Remove confirmation overlay */}
                {confirmRemove === b.carer_id && (
                  <div className="absolute inset-0 z-10 bg-white/95 rounded-3xl flex flex-col items-center justify-center gap-3 px-6 shadow-sm">
                    <p className="font-semibold text-gray-800 text-center">Remove <span className="text-sleep">{b.baby_name}</span> from your home screen?</p>
                    <p className="text-xs text-gray-400 text-center">The data won&apos;t be deleted. You can recover it any time from the Removed section below.</p>
                    <div className="flex gap-3 w-full">
                      <button onClick={() => handleRemove(b.carer_id)}
                        className="flex-1 bg-red-500 text-white rounded-xl py-3 font-semibold text-sm active:opacity-80">
                        Remove
                      </button>
                      <button onClick={() => setConfirmRemove(null)}
                        className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold text-sm active:opacity-80">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm">
                  <button
                    onClick={() => router.push(`/baby/${b.baby_id}`)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-14 h-14 bg-gradient-to-br from-sleep to-feed rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                      👶
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-bold text-gray-800">{b.baby_name}</p>
                      {b.birth_date && <p className="text-sm text-gray-500">{babyAge(b.birth_date)}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{b.role}</p>
                    </div>
                    <div className="text-gray-300 text-xl mr-1">›</div>
                  </button>
                  <button
                    onClick={() => setConfirmRemove(b.carer_id)}
                    className="p-2 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 active:bg-red-100 flex-shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => router.push("/setup?mode=new")}
            className="w-full bg-sleep text-white rounded-2xl p-4 flex items-center justify-center gap-2 text-lg font-semibold shadow active:scale-95 transition-transform"
          >
            <Plus size={22} /> Add a new baby
          </button>
          <button
            onClick={() => router.push("/setup?mode=join")}
            className="w-full bg-white border-2 border-sleep text-sleep rounded-2xl p-4 flex items-center justify-center gap-2 text-lg font-semibold shadow active:scale-95 transition-transform"
          >
            <Link size={20} /> Join with a code
          </button>
        </div>

        {/* Install card */}
        <InstallCard />

        {/* Delinked babies */}
        {delinked.length > 0 && (
          <div>
            <button
              onClick={() => setShowDelinked((v) => !v)}
              className="w-full flex items-center justify-between px-1 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
            >
              <span>Removed babies ({delinked.length})</span>
              {showDelinked ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDelinked && (
              <div className="space-y-2 mt-1">
                {delinked.map((b) => (
                  <div key={b.carer_id} className="bg-white/60 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center text-xl flex-shrink-0 grayscale">
                      👶
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-500">{b.baby_name}</p>
                      {b.birth_date && <p className="text-xs text-gray-400">{babyAge(b.birth_date)}</p>}
                      <p className="text-xs text-gray-300">{b.role}</p>
                    </div>
                    <button
                      onClick={() => handleRestore(b.carer_id)}
                      className="flex items-center gap-1.5 bg-sleep/10 text-sleep rounded-xl px-3 py-2 text-sm font-semibold active:bg-sleep/20 flex-shrink-0"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setShowShare(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Share</h2>
              <button onClick={() => setShowShare(false)} className="p-2 rounded-full bg-gray-100"><X size={20} /></button>
            </div>

            {shareMode === "choose" && (
              <div className="space-y-3">
                {/* Share app */}
                <button onClick={() => setShareMode("app")}
                  className="w-full bg-white border-2 border-gray-100 rounded-2xl p-4 flex items-center gap-4 text-left hover:border-sleep active:bg-gray-50">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">📲</div>
                  <div>
                    <p className="font-semibold text-gray-800">Share the app</p>
                    <p className="text-sm text-gray-400">Let someone install Baby Tracker</p>
                  </div>
                </button>

                {/* Share with baby */}
                {active.length > 0 && (
                  <button
                    onClick={() => {
                      if (active.length === 1) { setSelectedBaby(active[0]); setShareMode("baby"); }
                      else setShareMode("baby");
                    }}
                    className="w-full bg-white border-2 border-gray-100 rounded-2xl p-4 flex items-center gap-4 text-left hover:border-sleep active:bg-gray-50">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">👶</div>
                    <div>
                      <p className="font-semibold text-gray-800">Invite a carer</p>
                      <p className="text-sm text-gray-400">Share access to a baby&apos;s tracker</p>
                    </div>
                  </button>
                )}
              </div>
            )}

            {shareMode === "app" && (() => {
              const appUrl = "https://baby-tracker-flame-ten.vercel.app";
              const waText = `Hey! I use Baby Tracker to log feeds, sleep and more for my baby. It's free and works right in the browser — no app store needed!\n\n${appUrl}`;
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Share the app link with anyone — they can sign up and use it for free.</p>
                  <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#25D366] text-white rounded-2xl p-4 font-semibold flex items-center justify-center gap-3 active:opacity-80 text-lg">
                    <MessageCircle size={22} /> Share via WhatsApp
                  </a>
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <p className="flex-1 text-xs text-gray-500 font-mono truncate">{appUrl}</p>
                    <button onClick={async () => { await navigator.clipboard.writeText(appUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-600 active:bg-gray-50 flex-shrink-0">
                      {copied ? <><Check size={14} className="text-green-500" /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                  <button onClick={() => setShareMode("choose")} className="w-full text-gray-400 text-sm py-1">← Back</button>
                </div>
              );
            })()}

            {shareMode === "baby" && (() => {
              const baby = selectedBaby;
              if (!baby && active.length > 1) {
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Which baby would you like to share?</p>
                    {active.map((b) => (
                      <button key={b.baby_id} onClick={() => setSelectedBaby(b)}
                        className="w-full bg-white border-2 border-gray-100 rounded-2xl p-4 flex items-center gap-3 text-left hover:border-sleep active:bg-gray-50">
                        <span className="text-2xl">👶</span>
                        <span className="font-semibold text-gray-800">{b.baby_name}</span>
                      </button>
                    ))}
                    <button onClick={() => setShareMode("choose")} className="w-full text-gray-400 text-sm py-1">← Back</button>
                  </div>
                );
              }
              if (!baby) return null;
              const inviteLink = `https://baby-tracker-flame-ten.vercel.app/join/${baby.code}`;
              const waText = `Hi! I'd like to share access to ${baby.baby_name}'s Baby Tracker with you.\n\nTap the link to create your account and you'll be automatically connected:\n${inviteLink}`;
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Invite someone to track <strong>{baby.baby_name}</strong> with you.</p>
                  <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#25D366] text-white rounded-2xl p-4 font-semibold flex items-center justify-center gap-3 active:opacity-80 text-lg">
                    <MessageCircle size={22} /> Share via WhatsApp
                  </a>
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <p className="flex-1 text-xs text-gray-500 font-mono truncate">{inviteLink}</p>
                    <button onClick={async () => { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-600 active:bg-gray-50 flex-shrink-0">
                      {copied ? <><Check size={14} className="text-green-500" /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                  <p className="text-center text-xs text-gray-400">Baby code: <span className="font-mono font-bold text-sleep">{baby.code}</span></p>
                  <button onClick={() => { setSelectedBaby(null); setShareMode(active.length > 1 ? "baby" : "choose"); }} className="w-full text-gray-400 text-sm py-1">← Back</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
