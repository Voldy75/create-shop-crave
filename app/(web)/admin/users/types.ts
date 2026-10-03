export type UserStatus = "active" | "restricted" | "banned";
export type UserRole = "user" | "support" | "admin";
export type Platform = "web" | "ios" | "android";

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  status: UserStatus;
  status_reason: string | null;
  status_changed_at: string | null;
  status_changed_by?: string | null;
  plan_id: string | null;
  first_seen_platform: Platform | null;
  last_seen_platform: Platform | null;
  last_seen_at: string | null;
  created_at: string;
  chat_usage_7d: number;
}

export interface AdminPlan {
  id: string;
  name: string;
  is_active: boolean;
  sort: number;
  chat_daily_limit: number | null;
  photo_daily_limit: number | null;
  features: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  plan_prices?: AdminPlanPrice[];
}

export interface AdminPlanPrice {
  plan_id: string;
  platform: Platform;
  provider: "razorpay" | "stripe" | "apple" | "google";
  amount_minor: number;
  currency: string;
  interval: "one_time" | "month" | "year";
  store_product_id: string | null;
  is_active: boolean;
  created_at: string;
}
