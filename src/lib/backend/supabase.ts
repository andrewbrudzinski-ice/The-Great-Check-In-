import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import type { AppData, CheckIn, CheckInResult, Gym, Player, Punishment, Settings, WeekResult } from "../types";
import { loginEmail } from "../login-name";
import type { Backend, GymInput, Session } from "./types";

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
  radiusM: r.radius_m ?? null,
  gymId: r.gym_id ?? null,
  gymName: r.gym_name,
  manual: !!r.manual,
  addedBy: r.added_by ?? null,
  note: r.note ?? null,
  checkedInAt: new Date(r.checked_in_at).toISOString(),
});

const toSettings = (r: Row | null): Settings =>
  r
    ? {
        appTitle: r.app_title,
        appSubtitle: r.app_subtitle,
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
  checkInRadius: "check_in_radius",
  weeklyRequirement: "weekly_requirement",
  cooldownHours: "cooldown_hours",
  punishment: "punishment",
  timezone: "timezone",
};

const toGym = (r: Row): Gym => ({
  id: r.id,
  name: r.name,
  latitude: r.latitude,
  longitude: r.longitude,
  radiusM: r.radius_m,
  status: r.status,
  createdBy: r.created_by,
  approvedBy: r.approved_by,
  archived: r.archived,
  createdAt: r.created_at,
});

const ADMIN_CHECK_IN_ERRORS: Record<string, string> = {
  forbidden: "Only the admin can add check-ins for someone else.",
  no_player: "That player doesn't exist.",
  no_gym: "Pick an approved gym.",
  future: "That time is in the future.",
  too_old: "You can only go back 14 days.",
  duplicate: "They already have a check-in within the cooldown window of that time.",
  not_found: "That check-in is already gone (only manual ones can be removed).",
};

const GYM_ERRORS: Record<string, string> = {
  own_gym: "Someone else has to approve a gym you added.",
  forbidden: "Only the admin (or whoever added a still-pending gym) can do that.",
  not_found: "That gym doesn't exist anymore.",
  too_many: "That's a lot of gyms. Archive some first.",
  not_authenticated: "Sign in first.",
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

  async function gymRpc(fn: string, args: Record<string, unknown>): Promise<Row> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    const r = data as Row;
    if (!r?.ok) throw new Error(GYM_ERRORS[r?.code] ?? "Couldn't update the gym.");
    return r;
  }

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

    async signIn(name, password) {
      const { error } = await sb.auth.signInWithPassword({ email: loginEmail(name), password });
      if (error) {
        throw new Error(/invalid login credentials/i.test(error.message) ? "Wrong name or password." : error.message);
      }
    },

    async signUp({ name, password, inviteCode }) {
      const { data, error } = await sb.auth.signUp({
        email: loginEmail(name),
        password,
        options: { data: { name: name.trim(), invite_code: inviteCode } },
      });
      if (error) {
        if (/database error/i.test(error.message)) throw new Error("That invite code didn't work.");
        if (/already registered|already exists/i.test(error.message)) throw new Error("That name is taken. Try another.");
        if (/password/i.test(error.message)) throw new Error("Password needs at least 6 characters.");
        throw new Error(error.message);
      }
      if (!data.session) {
        // Name logins can't receive mail, so email confirmation must be off.
        throw new Error("Account created, but Supabase is waiting for an email confirmation that can't arrive. Ask the admin to turn off \"Confirm email\" in Supabase, then sign in.");
      }
      return { needsConfirmation: false };
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async finalizeWeeks() {
      const { error } = await sb.rpc("finalize_past_weeks");
      if (error) console.warn("finalize_past_weeks failed", error.message);
    },

    async load(): Promise<AppData> {
      const [players, checkIns, settings, results, punishments, gyms] = await Promise.all([
        selectAll(sb, "users", "*", "created_at"),
        selectAll(sb, "check_ins", "*", "checked_in_at"),
        sb.from("settings").select("*").eq("id", 1).maybeSingle(),
        selectAll(sb, "weekly_results", "*, weeks!inner(start_date)", "created_at"),
        selectAll(sb, "punishments", "*, weeks!inner(start_date)", "created_at"),
        selectAll(sb, "gyms", "*", "created_at"),
      ]);
      if (settings.error) throw settings.error;
      return {
        players: players.map(toPlayer),
        checkIns: checkIns.map(toCheckIn),
        settings: toSettings(settings.data),
        gyms: gyms.map(toGym),
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
          return { ok: false, code: "too_far", distance: r.distance, radius: r.radius, gymName: r.gym_name };
        case "gym_pending":
          return { ok: false, code: "gym_pending", gymName: r.gym_name };
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

    async addGym(input) {
      const r = await gymRpc("add_gym", { p_name: input.name, p_latitude: input.latitude, p_longitude: input.longitude, p_radius: input.radiusM });
      return toGym(r.gym);
    },

    async approveGym(id) {
      await gymRpc("approve_gym", { p_gym: id });
    },

    async updateGym(id, input: GymInput) {
      await gymRpc("update_gym", { p_gym: id, p_name: input.name, p_latitude: input.latitude, p_longitude: input.longitude, p_radius: input.radiusM });
    },

    async archiveGym(id) {
      await gymRpc("archive_gym", { p_gym: id });
    },

    async adminCheckIn({ userId, gymId, at, note }) {
      const { data, error } = await sb.rpc("admin_check_in", { p_user: userId, p_gym: gymId, p_at: at, p_note: note });
      if (error) throw new Error(error.message);
      const r = data as Row;
      if (!r?.ok) throw new Error(ADMIN_CHECK_IN_ERRORS[r?.code] ?? "Couldn't add the check-in.");
    },

    async adminRemoveCheckIn(id) {
      const { data, error } = await sb.rpc("admin_remove_check_in", { p_check_in: id });
      if (error) throw new Error(error.message);
      const r = data as Row;
      if (!r?.ok) throw new Error(ADMIN_CHECK_IN_ERRORS[r?.code] ?? "Couldn't remove the check-in.");
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
        .on("postgres_changes", { event: "*", schema: "public", table: "check_ins" }, () => cb())
        .on("postgres_changes", { event: "*", schema: "public", table: "punishments" }, () => cb())
        .on("postgres_changes", { event: "*", schema: "public", table: "gyms" }, () => cb())
        .subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },
  };
}
