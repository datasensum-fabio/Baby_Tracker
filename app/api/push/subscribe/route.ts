export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { carerId, babyId, endpoint, p256dh, auth } = await req.json();
  if (!carerId || !babyId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    { carer_id: carerId, baby_id: babyId, endpoint, p256dh, auth },
    { onConflict: "carer_id,endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
