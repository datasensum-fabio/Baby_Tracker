"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Dashboard from "@/components/Dashboard";

export default function BabyPage() {
  const router = useRouter();
  const params = useParams();
  const babyId = params.id as string;
  const [carerId, setCarerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: carer } = await supabase
        .from("carers")
        .select("id")
        .eq("baby_id", babyId)
        .eq("user_id", user.id)
        .single();

      if (!carer) { router.replace("/"); return; }

      setCarerId(carer.id);
      setReady(true);
    }
    check();
  }, [babyId, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-bounce">👶</div>
      </div>
    );
  }

  return <Dashboard babyId={babyId} carerId={carerId!} />;
}
