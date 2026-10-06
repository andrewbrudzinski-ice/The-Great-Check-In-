import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import type { AppData, CheckIn, CheckInResult, Player, Punishment, Settings, WeekResult } from "../types";
import type { Backend, Session } from "./types";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toPlayer = (r: Row): Player => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  color: r.color,
  isAdmin: r.is_admin,
  createdAt: r.created_at,
});

const toCheckIn = (r: Row): CheckIn => ({
  id: r.id,
  userId: r.user_id,
  latitude: r.latitude,
  longitude: r.longitude,
  accuracy: r.accuracy,
  distanceM: r.distance_m,
  gymName: r.gym_name,
  checkedInAt: new Date(r.checked_in_at).toISOString(),
});

const toSettings = (r: Row | null): Settings =>
  r
    ? {
        appTitle: r.app_title,
        appSubtitle: r.app_subtitle,
        gymName: r.gym_name,
        gymLatitude: r.gym_latitude,
        gymLongitude: r.gym_longitude,
        checkInRadius: r.check_in_radius,
        weeklyRequirement: r.weekly_requirement,
        cooldownHours: Number(r.cooldown_hours),
        punishment: r.punishment,
        timezone: r.timezone,
      }
    : DEFAULT_SETTINGS;

const SETTINGS_COLUMNS: Record<keyof Settings, string> = {
  appTitle: "app_title",
  appSubtitle: "app_subtitle",
  gymName: "gym_name",
  gymLatitude: "gym_latitude",
  gymLongitude: "gym_longitude",
  checkInRadius: "check_in_radius",
  weeklyRequirement: "weekly_requirement",
  cooldownHours: "cooldown_hours",
  punishment: "punishment",
  timezone: "timezone",
};

/** Supabase caps a select at 1000 rows by default — page through. */
async function selectAll(sb: SupabaseClient, table: string, columns: string, order: string): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(columns).order(order).range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data as unknown as Row[]) ?? []));
    if (!data || data.length < page) return out;
  }
}

export function createSupabaseBackend(): Backend {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email } : null;

  return {
    mode: "supabase",

    async getSession() {
      const { data } = await sb.auth.getSession();
      return toSession(data.session);
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toSession(s)));
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },

    async signUp({ email, password, name, inviteCode }) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name, invite_code: inviteCode } },
      });
      if (error) {
        throw new Error(/database error/i.test(error.message) ? "That invite code didn't work." : error.message);
      }
      return { needsConfirmation: !data.session };
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async finalizeWeeks() {
      const { error } = await sb.rpc("finalize_past_weeks");
      if (error) console.warn("finalize_past_weeks failed", error.message);
    },

    async load(): Promise<AppData> {
      const [players, checkIns, settings, results, punishments] = await Promise.all([
        selectAll(sb, "users", "*", "created_at"),
        selectAll(sb, "check_ins", "*", "checked_in_at"),
        sb.from("settings").select("*").eq("id", 1).maybeSingle(),
        selectAll(sb, "weekly_results", "*, weeks!inner(start_date)", "created_at"),
        selectAll(sb, "punishments", "*, weeks!inner(start_date)", "created_at"),
      ]);
      if (settings.error) throw settings.error;
      return {
        players: players.map(toPlayer),
        checkIns: checkIns.map(toCheckIn),
        settings: toSettings(settings.data),
        punishments: punishments.map(
          (r): Punishment => ({
            weekStart: r.weeks.start_date,
            text: r.punishment,
            status: r.status,
            completedAt: r.completed_at,
            completedBy: r.completed_by,
          }),
        ),
        results: results.map(
          (r): WeekResult => ({
            weekStart: r.weeks.start_date,
            userId: r.user_id,
            count: r.check_in_count,
            requirement: r.requirement,
            completed: r.completed,
            punishment: r.punishment,
          }),
        ),
      };
    },

    async checkIn({ latitude, longitude, accuracy }): Promise<CheckInResult> {
      const { data, error } = await sb.rpc("check_in", {
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy,
      });
      if (error) return { ok: false, code: "error", message: error.message };
      const r = data as Row;
      if (r.ok) return { ok: true, checkIn: toCheckIn(r.check_in) };
      switch (r.code) {
        case "too_far":
          return { ok: false, code: "too_far", distance: r.distance, radius: r.radius };
        case "cooldown":
          return { ok: false, code: "cooldown", nextAllowedAt: new Date(r.next_allowed_at).toISOString() };
        case "low_accuracy":
          return { ok: false, code: "low_accuracy", accuracy: r.accuracy };
        default:
          return { ok: false, code: r.code };
      }
    },

    async updateSettings(patch) {
      const row: Row = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(patch)) row[SETTINGS_COLUMNS[k as keyof Settings]] = v;
      const { data, error } = await sb.from("settings").update(row).eq("id", 1).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Only the club admin can change these settings.");
    },

    async setPunishmentDone(weekStart, done) {
      const { data, error } = await sb.rpc("set_punishment_done", { p_week_start: weekStart, p_done: done });
      if (error) throw new Error(error.message);
      if (!(data as Row)?.ok) throw new Error("Couldn't update that punishment.");
    },

    async updatePlayer(id, patch) {
      const { data, error } = await sb.from("users").update(patch).eq("id", id).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("You can only edit your own profile.");
    },

    subscribe(cb) {
      const channel = sb
        .channel("check-ins")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "check_ins" }, () => cb())
        .on("postgres_changes", { event: "*", schema: "public", table: "punishments" }, () => cb())
        .subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },
  };
}
