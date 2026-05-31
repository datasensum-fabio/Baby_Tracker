"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      router.replace("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-yellow-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">👶</div>
          <h1 className="text-3xl font-bold text-gray-800">New password</h1>
        </div>
        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters" autoComplete="new-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password" autoComplete="new-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-sleep" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleReset} disabled={loading}
            className="w-full bg-sleep text-white rounded-xl p-4 text-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform">
            {loading ? "Saving..." : "Set new password →"}
          </button>
        </div>
      </div>
    </div>
  );
}
