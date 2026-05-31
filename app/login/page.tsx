"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit() {
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setError("");
    setInfo("");

    try {
      if (mode === "login") {
        if (!password) { setError("Please enter your password."); setLoading(false); return; }
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        router.replace("/");

      } else if (mode === "signup") {
        if (!password || password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        setInfo("Account created! Check your email to confirm, then sign in.");
        setMode("login");

      } else if (mode === "reset") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setInfo("Password reset email sent. Check your inbox.");
        setMode("login");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, string> = {
    login: "Welcome back",
    signup: "Create account",
    reset: "Reset password",
  };

  const buttons: Record<Mode, string> = {
    login: "Sign in →",
    signup: "Create account →",
    reset: "Send reset email →",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">👶</div>
          <h1 className="text-3xl font-bold text-gray-800">Baby Tracker</h1>
          <p className="text-gray-500 mt-1">Track feeds, sleep & more together</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">{titles[mode]}</h2>

          {info && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
              {info}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep"
            />
          </div>

          {mode !== "reset" && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep"
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? "Please wait..." : buttons[mode]}
          </button>

          <div className="flex flex-col items-center gap-2 pt-1">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("signup"); setError(""); setInfo(""); }} className="text-sleep text-sm font-medium">
                  No account? Sign up
                </button>
                <button onClick={() => { setMode("reset"); setError(""); setInfo(""); }} className="text-gray-400 text-sm">
                  Forgot password?
                </button>
              </>
            )}
            {mode !== "login" && (
              <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} className="text-gray-400 text-sm">
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
