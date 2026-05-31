"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Baby {
  id: string;
  name: string;
  birth_date: string | null;
}

const roles = ["Mum", "Dad", "Granny", "Grandad", "Aunt", "Uncle", "Nanny", "Other"];

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [baby, setBaby] = useState<Baby | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [carerName, setCarerName] = useState("");
  const [carerRole, setCarerRole] = useState("Mum");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  // Step: "join-form" | "need-account" | "done"
  const [step, setStep] = useState<"join-form" | "need-account" | "done">("join-form");

  // Auth fields (shown when user needs to create account / sign in)
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    async function loadBaby() {
      const { data } = await supabase.from("babies").select("id, name, birth_date").eq("code", code).single();
      if (!data) { setNotFound(true); } else { setBaby(data); }
      setChecking(false);
    }
    loadBaby();
  }, [code]);

  function errMsg(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
    return "Something went wrong.";
  }

  async function completeJoin(userId: string) {
    if (!baby) return;
    // Check if already a carer
    const { data: existing } = await supabase
      .from("carers").select("id").eq("baby_id", baby.id).eq("user_id", userId).single();
    if (existing) {
      router.push(`/baby/${baby.id}`);
      return;
    }
    const carerId = crypto.randomUUID();
    const { error: carerErr } = await supabase
      .from("carers").insert({ id: carerId, baby_id: baby.id, name: carerName.trim(), role: carerRole, user_id: userId });
    if (carerErr) throw carerErr;
    router.push(`/baby/${baby.id}`);
  }

  async function handleJoinClick() {
    if (!carerName.trim()) { setError("Please enter your name."); return; }
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await completeJoin(user.id);
      } else {
        // Save intent to localStorage, then show auth
        localStorage.setItem("pending_join_code", code);
        localStorage.setItem("pending_join_name", carerName.trim());
        localStorage.setItem("pending_join_role", carerRole);
        setStep("need-account");
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth() {
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError("");
    try {
      let userId: string;
      if (authMode === "signup") {
        const { data, error: signupErr } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signupErr) throw signupErr;
        if (!data.user) throw new Error("Signup failed — please try signing in instead.");
        userId = data.user.id;
      } else {
        const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginErr) throw loginErr;
        userId = data.user.id;
      }
      await completeJoin(userId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-bounce">👶</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-xl">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invite not found</h2>
          <p className="text-gray-500 text-sm">This invite link may have expired or is incorrect. Ask the person who shared it to send a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        {/* Baby card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-sleep to-feed px-6 py-5 text-white text-center">
            <p className="text-5xl mb-2">👶</p>
            <h1 className="text-2xl font-bold">{baby?.name}</h1>
            <p className="text-white/70 text-sm mt-1">Baby Tracker invite</p>
          </div>

          <div className="p-6 space-y-4">
            {step === "join-form" && (
              <>
                <p className="text-gray-600 text-sm text-center">
                  You&apos;ve been invited to track <strong>{baby?.name}</strong>&apos;s activities. Enter your details to get started.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Your name *</label>
                  <input type="text" value={carerName} onChange={(e) => setCarerName(e.target.value)}
                    placeholder="e.g. Gran" autoFocus
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
                <button onClick={handleJoinClick} disabled={loading}
                  className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
                  {loading ? "Please wait..." : `Join ${baby?.name}'s tracker →`}
                </button>
              </>
            )}

            {step === "need-account" && (
              <>
                <p className="text-gray-600 text-sm text-center">
                  Almost there! {authMode === "signup" ? "Create a free account" : "Sign in"} to complete joining <strong>{baby?.name}</strong>&apos;s tracker.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === "signup" ? "At least 6 characters" : "Your password"}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={handleAuth} disabled={loading}
                  className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
                  {loading ? "Please wait..." : authMode === "signup" ? "Create account & join →" : "Sign in & join →"}
                </button>
                <button
                  onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setError(""); }}
                  className="w-full text-sleep text-sm font-medium py-1"
                >
                  {authMode === "signup" ? "Already have an account? Sign in" : "No account? Sign up"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
