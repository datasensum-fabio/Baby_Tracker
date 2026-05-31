import { formatDistanceToNow, format } from "date-fns";
import { ActivityType, Activity } from "./types";

export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatTime(date: string): string {
  return format(new Date(date), "HH:mm");
}

export function formatDateTime(date: string): string {
  return format(new Date(date), "dd MMM, HH:mm");
}

export function activityLabel(type: ActivityType): string {
  return { feed: "Feed", sleep: "Sleep", medication: "Medication", nappy: "Nappy" }[type];
}

export function activityEmoji(type: ActivityType): string {
  return { feed: "🍼", sleep: "😴", medication: "💊", nappy: "🩲" }[type];
}

export function activityColor(type: ActivityType): string {
  return {
    feed: "bg-feed text-white",
    sleep: "bg-sleep text-white",
    medication: "bg-medication text-white",
    nappy: "bg-nappy text-white",
  }[type];
}

export function activityLightColor(type: ActivityType): string {
  return {
    feed: "bg-feed-light border-feed",
    sleep: "bg-sleep-light border-sleep",
    medication: "bg-medication-light border-medication",
    nappy: "bg-nappy-light border-nappy",
  }[type];
}

export function activityTextColor(type: ActivityType): string {
  return {
    feed: "text-feed-dark",
    sleep: "text-sleep-dark",
    medication: "text-medication-dark",
    nappy: "text-nappy-dark",
  }[type];
}

export function summariseActivity(activity: Activity): string {
  const d = activity.details as unknown as Record<string, unknown>;
  switch (activity.type) {
    case "feed": {
      const labels: Record<string, string> = {
        breast_left: "Left breast",
        breast_right: "Right breast",
        both_breasts: "Both breasts",
        formula: "Formula",
        bottle: "Bottle",
      };
      const feedType = labels[d.feed_type as string] ?? d.feed_type;
      if (d.duration_min) return `${feedType} · ${d.duration_min} min`;
      if (d.amount_ml) return `${feedType} · ${d.amount_ml} ml`;
      return feedType;
    }
    case "sleep": {
      if (d.duration_min) return `${d.duration_min} min`;
      if (d.end_time) return "Ended";
      return "Sleeping...";
    }
    case "medication":
      return `${d.name} ${d.dose}${d.unit}`;
    case "nappy": {
      const labels: Record<string, string> = {
        wet: "Wet",
        dirty: "Dirty",
        both: "Wet & Dirty",
        dry: "Dry",
      };
      const base = labels[d.nappy_type as string] ?? (d.nappy_type as string);
      return d.color ? `${base} · ${d.color}` : base;
    }
    default:
      return "";
  }
}

export function generateCode(): string {
  const words = ["STAR", "MOON", "BEAR", "DUCK", "LION", "ROSE", "BIRD", "DOVE"];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${w1}-${w2}-${n}`;
}
