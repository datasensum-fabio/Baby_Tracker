"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";
import { Plus, LogOut, Link } from "lucide-react";

interface BabyEntry {
  baby_id: string;
  baby_name: string;
  birth_date: string | null;
  role: string;
  code: string;
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserEmail(user.email ?? "");

      const { data } = await supabase
        .from("carers")
        .select("id, baby_id, role, babies(id, name, birth_date, code)")
        .eq("user_id", user.id);

      if (data) {
        setBabies(
          data
            .filter((c) => c.babies)
            .map((c) => {
              const b = c.babies as unknown as { id: string; name: string; birth_date: string | null; code: string };
              return { baby_id: b.id, baby_name: b.name, birth_date: b.birth_date, role: c.role, code: b.code };
            })
        );
      }
      setLoading(false);
    }
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, [router]);

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
        <button onClick={signOut} className="p-2 bg-white/20 rounded-full active:bg-white/30">
          <LogOut size={18} />
        </button>
      </div>

      <div className="px-4 py-6 space-y-4">
        {babies.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
            <p className="text-5xl mb-3">👶</p>
            <p className="text-gray-600 font-medium">No babies yet</p>
            <p className="text-gray-400 text-sm mt-1">Add your baby or join with a code</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your babies</p>
            {babies.map((b) => (
              <button
                key={b.baby_id}
                onClick={() => router.push(`/baby/${b.baby_id}`)}
                className="w-full bg-white rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm active:scale-98 transition-transform text-left"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-sleep to-feed rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                  👶
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-gray-800">{b.baby_name}</p>
                  {b.birth_date && <p className="text-sm text-gray-500">{babyAge(b.birth_date)}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{b.role}</p>
                </div>
                <div className="text-gray-300 text-xl">›</div>
              </button>
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
      </div>
    </div>
  );
}
