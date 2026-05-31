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

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong. Please try again.";
}

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [baby, setBaby] = useState<Baby | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(true);

  // Step 1: enter name/role
  const [carerName, setCarerName] = useState("");
  const [carerRole, setCarerRole] = useState("Mum");

  // Step 2: create account or sign in
  const [step, setStep] = useState<"details" | "auth">("details");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Look up baby — no auth required (policy allows public read)
  useEffect(() => {
    async function loadBaby() {
      const { data, error: err } = await supabase
        .from("babies")
        .select("id, name, birth_date")
        .eq("code", code)
        .single();
      if (err || !data) {
        setNotFound(true);
      } else {
        setBaby(data);
      }
      setChecking(false);
    }
    loadBaby();
  }, [code]);

  async function completeJoin(userId: string) {
    if (!baby) return;
    // Already a carer? Just go to dashboard
    const { data: existing } = await supabase
      .from("carers").select("id").eq("baby_id", baby.id).eq("user_id", userId).single();
    if (existing) {
      router.push(`/baby/${baby.id}`);
      return;
    }
    const carerId = crypto.randomUUID();
    const { error: carerErr } = await supabase.from("carers").insert({
      id: carerId,
      baby_id: baby.id,
      name: carerName.trim(),
      role: carerRole,
      user_id: userId,
    });
    if (carerErr) throw carerErr;
    router.push(`/baby/${baby.id}`);
  }

  // Step 1 submit: check if already logged in, otherwise go to auth step
  async function handleDetailsSubmit() {
    if (!carerName.trim()) { setError("Please enter your name."); return; }
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await completeJoin(user.id);
      } else {
        setStep("auth");
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // Step 2 submit: sign up or log in, then join
  async function handleAuth() {
    if (!email.trim() || password.length < 6) {
      setError(password.length < 6 ? "Password must be at least 6 characters." : "Please enter your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      let userId: string;
      if (authMode === "signup") {
        const { data, error: signupErr } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signupErr) throw signupErr;
        if (!data.user) throw new Error("Signup failed — please try again.");
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

  // Loading state
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50">
        <div className="text-5xl animate-bounce">👶</div>
      </div>
    );
  }

  // Not found
  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-xl">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invite not found</h2>
          <p className="text-gray-500 text-sm">This invite link may be invalid. Ask for a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Baby hero card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-sleep to-feed px-6 py-6 text-white text-center">
            <div className="text-5xl mb-2">👶</div>
            <h1 className="text-2xl font-bold">{baby?.name}</h1>
            <p className="text-white/70 text-sm mt-1">You&apos;ve been invited to Baby Tracker</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex-1 h-1 rounded-full ${step === "details" ? "bg-sleep" : "bg-sleep"}`} />
              <div className={`flex-1 h-1 rounded-full ${step === "auth" ? "bg-sleep" : "bg-gray-200"}`} />
            </div>

            {/* Step 1: Your details */}
            {step === "details" && (
              <>
                <p className="text-gray-600 text-sm text-center">
                  Tell us who you are, then create your free account.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Your name *</label>
                  <input
                    type="text" value={carerName} onChange={(e) => setCarerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDetailsSubmit()}
                    placeholder="e.g. Gran" autoFocus
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Your role</label>
                  <select value={carerRole} onChange={(e) => setCarerRole(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep bg-white">
                    {roles.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={handleDetailsSubmit} disabled={loading}
                  className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
                  {loading ? "Checking..." : "Continue →"}
                </button>
              </>
            )}

            {/* Step 2: Create account / sign in */}
            {step === "auth" && (
              <>
                <p className="text-gray-600 text-sm text-center">
                  {authMode === "signup"
                    ? `Create a free account to start tracking ${baby?.name}.`
                    : `Sign in to connect to ${baby?.name}'s tracker.`}
                </p>

                {/* Toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button onClick={() => { setAuthMode("signup"); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${authMode === "signup" ? "bg-white text-sleep shadow-sm" : "text-gray-400"}`}>
                    New here
                  </button>
                  <button onClick={() => { setAuthMode("login"); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${authMode === "login" ? "bg-white text-sleep shadow-sm" : "text-gray-400"}`}>
                    I have an account
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    placeholder="you@example.com" autoComplete="email" autoFocus
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    placeholder={authMode === "signup" ? "Choose a password (6+ chars)" : "Your password"}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button onClick={handleAuth} disabled={loading}
                  className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
                  {loading ? "Please wait..." : authMode === "signup" ? `Create account & join →` : `Sign in & join →`}
                </button>

                <button onClick={() => { setStep("details"); setError(""); }} className="w-full text-gray-400 text-sm py-1">
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Baby Tracker · Free · No app store needed
        </p>
      </div>
    </div>
  );
}
