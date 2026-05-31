export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { differenceInMinutes } from "date-fns";


function minsToLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendPush(db: any, sub: { endpoint: string; p256dh: string; auth: string }, title: string, body: string) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, icon: "/icon.svg", badge: "/icon.svg" })
    );
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e && (e as { statusCode: number }).statusCode === 410) {
      await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lazy init to avoid build-time failures
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();

  // Get all babies with settings
  const { data: allSettings } = await supabase.from("baby_settings").select("*");
  if (!allSettings) return NextResponse.json({ ok: true });

  for (const setting of allSettings) {
    const babyId: string = setting.baby_id;
    const lastAlertsSent: Record<string, string> = setting.last_alerts_sent ?? {};

    // Get baby name
    const { data: baby } = await supabase.from("babies").select("name").eq("id", babyId).single();
    const babyName = baby?.name ?? "Baby";

    // Get push subscriptions for this baby's carers
    const { data: subs } = await supabase
      .from("push_subscriptions").select("endpoint, p256dh, auth").eq("baby_id", babyId);
    if (!subs || subs.length === 0) continue;

    // Get latest activities for this baby
    const { data: activities } = await supabase
      .from("activities")
      .select("type, logged_at, details")
      .eq("baby_id", babyId)
      .is("deleted_at", null)
      .order("logged_at", { ascending: false })
      .limit(100);

    const latestByType = (type: string) =>
      activities?.find((a) => a.type === type);

    const newAlerts: Record<string, string> = { ...lastAlertsSent };
    const notifications: { title: string; body: string }[] = [];

    // ── FEED alert ──
    if (setting.feed_alert_min) {
      const last = latestByType("feed");
      const alertKey = "feed";
      const lastSent = lastAlertsSent[alertKey] ? new Date(lastAlertsSent[alertKey]) : null;
      const lastActivity = last ? new Date(last.logged_at) : null;

      // Overdue if no activity or activity older than threshold
      const minsAgo = lastActivity ? differenceInMinutes(now, lastActivity) : Infinity;
      const overdue = minsAgo > setting.feed_alert_min;

      // Only notify if: overdue AND (never sent OR last sent was before the last activity)
      const shouldNotify = overdue && (!lastSent || (lastActivity && lastSent < lastActivity) || !lastActivity);

      if (shouldNotify) {
        const timeStr = lastActivity ? `${minsToLabel(Math.round(minsAgo))} ago` : "never";
        notifications.push({
          title: `🍼 ${babyName} needs a feed`,
          body: `Last feed: ${timeStr} — over the ${minsToLabel(setting.feed_alert_min)} alert`,
        });
        newAlerts[alertKey] = now.toISOString();
      } else if (!overdue && lastSent && lastActivity && lastActivity > lastSent) {
        // Activity logged after last alert — reset
        delete newAlerts[alertKey];
      }
    }

    // ── NAPPY alert ──
    if (setting.nappy_alert_min) {
      const last = latestByType("nappy");
      const alertKey = "nappy";
      const lastSent = lastAlertsSent[alertKey] ? new Date(lastAlertsSent[alertKey]) : null;
      const lastActivity = last ? new Date(last.logged_at) : null;
      const minsAgo = lastActivity ? differenceInMinutes(now, lastActivity) : Infinity;
      const overdue = minsAgo > setting.nappy_alert_min;
      const shouldNotify = overdue && (!lastSent || (lastActivity && lastSent < lastActivity) || !lastActivity);

      if (shouldNotify) {
        const timeStr = lastActivity ? `${minsToLabel(Math.round(minsAgo))} ago` : "never";
        notifications.push({
          title: `🩲 ${babyName} nappy check`,
          body: `Last change: ${timeStr} — over the ${minsToLabel(setting.nappy_alert_min)} alert`,
        });
        newAlerts[alertKey] = now.toISOString();
      } else if (!overdue && lastSent && lastActivity && lastActivity > lastSent) {
        delete newAlerts[alertKey];
      }
    }

    // ── SLEEP alert ──
    if (setting.sleep_alert_min) {
      const last = latestByType("sleep");
      const alertKey = "sleep";
      const lastSent = lastAlertsSent[alertKey] ? new Date(lastAlertsSent[alertKey]) : null;
      const lastActivity = last ? new Date(last.logged_at) : null;
      const minsAgo = lastActivity ? differenceInMinutes(now, lastActivity) : Infinity;
      const overdue = minsAgo > setting.sleep_alert_min;
      const shouldNotify = overdue && (!lastSent || (lastActivity && lastSent < lastActivity) || !lastActivity);

      if (shouldNotify) {
        notifications.push({
          title: `😴 ${babyName} sleep alert`,
          body: `Sleeping for ${minsToLabel(Math.round(minsAgo))} — over the ${minsToLabel(setting.sleep_alert_min)} alert`,
        });
        newAlerts[alertKey] = now.toISOString();
      } else if (!overdue && lastSent && lastActivity && lastActivity > lastSent) {
        delete newAlerts[alertKey];
      }
    }

    // ── PER-DRUG medication alerts ──
    const { data: drugs } = await supabase
      .from("baby_drugs").select("*").eq("baby_id", babyId);

    for (const drug of drugs ?? []) {
      if (!drug.alert_min) continue;
      const alertKey = `med:${drug.name}`;
      const lastSent = lastAlertsSent[alertKey] ? new Date(lastAlertsSent[alertKey]) : null;

      const lastForDrug = activities?.find(
        (a) => a.type === "medication" &&
          (a.details as Record<string, unknown>)?.name === drug.name
      );
      const lastActivity = lastForDrug ? new Date(lastForDrug.logged_at) : null;
      const minsAgo = lastActivity ? differenceInMinutes(now, lastActivity) : Infinity;
      const overdue = minsAgo > drug.alert_min;
      const shouldNotify = overdue && (!lastSent || (lastActivity && lastSent < lastActivity) || !lastActivity);

      if (shouldNotify) {
        const timeStr = lastActivity ? `${minsToLabel(Math.round(minsAgo))} ago` : "never given";
        notifications.push({
          title: `💊 ${babyName} — ${drug.name} due`,
          body: `Last dose: ${timeStr} — over the ${minsToLabel(drug.alert_min)} alert`,
        });
        newAlerts[alertKey] = now.toISOString();
      } else if (!overdue && lastSent && lastActivity && lastActivity > lastSent) {
        delete newAlerts[alertKey];
      }
    }

    // Send all notifications for this baby
    for (const notif of notifications) {
      await Promise.all(subs.map((sub) => sendPush(supabase, sub, notif.title, notif.body)));
    }

    // Update last_alerts_sent
    if (JSON.stringify(newAlerts) !== JSON.stringify(lastAlertsSent)) {
      await supabase.from("baby_settings")
        .update({ last_alerts_sent: newAlerts })
        .eq("baby_id", babyId);
    }
  }

  return NextResponse.json({ ok: true, checked: allSettings.length });
}
