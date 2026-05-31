"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateCode } from "@/lib/helpers";

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}

function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"choose" | "new" | "join">("choose");

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "new" || m === "join") setMode(m);
  }, [searchParams]);
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [carerName, setCarerName] = useState("");
  const [carerRole, setCarerRole] = useState("Mum");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const roles = ["Mum", "Dad", "Granny", "Grandad", "Aunt", "Uncle", "Nanny", "Other"];

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return null; }
    return user;
  }

  async function handleCreate() {
    if (!babyName.trim() || !carerName.trim()) { setError("Please fill in all fields."); return; }
    const user = await getCurrentUser();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // Pre-generate IDs so we don't need to read back before the carer record exists
      const babyId = crypto.randomUUID();
      const carerId = crypto.randomUUID();
      const code = generateCode();

      const { error: babyErr } = await supabase
        .from("babies").insert({ id: babyId, name: babyName.trim(), birth_date: birthDate || null, code });
      if (babyErr) throw babyErr;

      const { error: carerErr } = await supabase
        .from("carers").insert({ id: carerId, baby_id: babyId, name: carerName.trim(), role: carerRole, user_id: user.id });
      if (carerErr) throw carerErr;

      router.push(`/baby/${babyId}`);
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !carerName.trim()) { setError("Please fill in all fields."); return; }
    const user = await getCurrentUser();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { data: baby, error: babyErr } = await supabase
        .from("babies").select().eq("code", joinCode.trim().toUpperCase()).single();
      if (babyErr || !baby) { setError("Baby code not found. Check the code and try again."); setLoading(false); return; }

      // Check if this user already has a carer record for this baby
      const { data: existing } = await supabase
        .from("carers").select("id").eq("baby_id", baby.id).eq("user_id", user.id).single();
      if (existing) {
        router.push(`/baby/${baby.id}`);
        return;
      }

      const carerId = crypto.randomUUID();
      const { error: carerErr } = await supabase
        .from("carers").insert({ id: carerId, baby_id: baby.id, name: carerName.trim(), role: carerRole, user_id: user.id });
      if (carerErr) throw carerErr;

      router.push(`/baby/${baby.id}`);
    } catch (e: unknown) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">👶</div>
          <h1 className="text-3xl font-bold text-gray-800">Baby Tracker</h1>
          <p className="text-gray-500 mt-1">Track feeds, sleep & more together</p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button onClick={() => setMode("new")}
              className="w-full bg-sleep text-white rounded-2xl p-4 text-lg font-semibold shadow-lg active:scale-95 transition-transform">
              🍼 Add a new baby
            </button>
            <button onClick={() => setMode("join")}
              className="w-full bg-white border-2 border-sleep text-sleep rounded-2xl p-4 text-lg font-semibold shadow active:scale-95 transition-transform">
              🔗 Join with a code
            </button>
          </div>
        )}

        {mode === "new" && (
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">New baby setup</h2>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Baby&apos;s name *</label>
              <input type="text" value={babyName} onChange={(e) => setBabyName(e.target.value)} placeholder="e.g. Emma"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Date of birth (optional)</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Your name *</label>
              <input type="text" value={carerName} onChange={(e) => setCarerName(e.target.value)} placeholder="e.g. Sarah"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Your role</label>
              <select value={carerRole} onChange={(e) => setCarerRole(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep bg-white">
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleCreate} disabled={loading}
              className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? "Creating..." : "Get started →"}
            </button>
            <button onClick={() => { setMode("choose"); setError(""); }} className="w-full text-gray-400 text-sm py-1">← Back</button>
          </div>
        )}

        {mode === "join" && (
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Join a baby</h2>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Baby code *</label>
              <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. STAR-MOON-1234"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-feed tracking-wider" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Your name *</label>
              <input type="text" value={carerName} onChange={(e) => setCarerName(e.target.value)} placeholder="e.g. Gran"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-feed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Your role</label>
              <select value={carerRole} onChange={(e) => setCarerRole(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-feed bg-white">
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleJoin} disabled={loading}
              className="w-full bg-feed text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? "Joining..." : "Join →"}
            </button>
            <button onClick={() => { setMode("choose"); setError(""); }} className="w-full text-gray-400 text-sm py-1">← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SetupPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-bounce">👶</div></div>}>
      <SetupPage />
    </Suspense>
  );
}
