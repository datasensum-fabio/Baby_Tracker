export type ActivityType = "feed" | "sleep" | "medication" | "nappy";

export interface Baby {
  id: string;
  name: string;
  birth_date: string | null;
  code: string;
  created_at: string;
}

export interface Carer {
  id: string;
  baby_id: string;
  name: string;
  role: string;
  created_at: string;
}

export interface Activity {
  id: string;
  baby_id: string;
  carer_id: string;
  carer_name?: string;
  type: ActivityType;
  details: FeedDetails | SleepDetails | MedicationDetails | NappyDetails;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

export interface FeedDetails {
  feed_type: "breast_left" | "breast_right" | "both_breasts" | "formula" | "bottle";
  amount_ml?: number;
  duration_min?: number;
}

export interface SleepDetails {
  start_time: string;
  end_time?: string;
  duration_min?: number;
}

export interface MedicationDetails {
  name: string;
  dose: number;
  unit: string;
}

export interface NappyDetails {
  nappy_type: "wet" | "dirty" | "both" | "dry";
  color?: string;
}
