"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const babyId = localStorage.getItem("baby_id");
    const carerId = localStorage.getItem("carer_id");
    if (!babyId || !carerId) {
      router.replace("/setup");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <Dashboard />;
}
