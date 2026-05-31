"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const babyId = localStorage.getItem("baby_id");
      const carerId = localStorage.getItem("carer_id");

      if (babyId && carerId) {
        // Verify the carer still belongs to this user
        const { data } = await supabase.from("carers").select("id").eq("id", carerId).eq("user_id", user.id).single();
        if (data) { setReady(true); return; }
        // Stale local data — clear and re-setup
        localStorage.removeItem("baby_id");
        localStorage.removeItem("carer_id");
        localStorage.removeItem("baby_code");
      }

      // Check if user already has a carer record (e.g. returning on new device)
      const { data: carer } = await supabase.from("carers").select("id, baby_id").eq("user_id", user.id).limit(1).single();
      if (carer) {
        localStorage.setItem("baby_id", carer.baby_id);
        localStorage.setItem("carer_id", carer.id);
        setReady(true);
        return;
      }

      router.replace("/setup");
    }
    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-bounce">👶</div>
      </div>
    );
  }
  return <Dashboard />;
}
