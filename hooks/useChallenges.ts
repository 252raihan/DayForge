"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isTaskEligibleToday } from "@/lib/home-scope";
import { todayKey } from "@/hooks/useTasks";
import { buildChallengeProgress } from "@/lib/challenge-utils";
import type {
  Challenge,
  ChallengeCheckin,
  ChallengeInsert,
  ChallengeProgress,
  HabitLog,
  Task,
  TaskDailyLog,
} from "@/types";

// Challenges data access, in the same shape as useTasks/useNotes.
//
// Progress is never invented. Depending on the challenge's `goal_type` it is
// counted from rows that already exist and are already owned by the user:
//
//   checkin_count      → rows in challenge_checkins
//   task_completion    → daily task logs marked completed inside the window
//   habit_completion   → habit check-ins inside the window
//   manual             → no measurement; the challenge is just tracked
//
// The counting itself lives in lib/challenge-utils.ts so it is pure and
// directly testable without a database.

export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [checkins, setCheckins] = useState<ChallengeCheckin[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskDailyLog[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // All five queries are RLS-scoped to the signed-in user. They run together
    // because progress needs all of them to be meaningful.
    const [challengesResult, checkinsResult, taskLogsResult, habitLogsResult, tasksResult] =
      await Promise.all([
        supabase.from("challenges").select("*").order("created_at", { ascending: false }),
        supabase.from("challenge_checkins").select("*").order("log_date", { ascending: true }),
        supabase.from("task_daily_logs").select("*").order("log_date", { ascending: true }),
        supabase.from("habit_logs").select("*").order("log_date", { ascending: true }),
        supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
      ]);

    // Surface the first real failure rather than reporting an empty list, which
    // would look like "you have no challenges".
    const failure =
      challengesResult.error ??
      checkinsResult.error ??
      taskLogsResult.error ??
      habitLogsResult.error ??
      tasksResult.error;

    if (failure) {
      console.error("[DayForge] failed to load challenges:", failure.message);
      setError(failure.message);
      setLoading(false);
      return;
    }

    setChallenges((challengesResult.data as Challenge[]) ?? []);
    setCheckins((checkinsResult.data as ChallengeCheckin[]) ?? []);
    setTaskLogs((taskLogsResult.data as TaskDailyLog[]) ?? []);
    setHabitLogs((habitLogsResult.data as HabitLog[]) ?? []);
    setTasks((tasksResult.data as Task[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createChallenge = useCallback(async (values: ChallengeInsert) => {
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from("challenges")
      .insert(values)
      .select()
      .single();

    if (insertError) {
      console.error("[DayForge] failed to create challenge:", insertError.message);
      throw new Error("Could not create the challenge. Please try again.");
    }

    const created = data as Challenge;
    setChallenges((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateChallenge = useCallback(async (id: string, values: Partial<ChallengeInsert>) => {
    const supabase = createClient();

    // `.select()` so a write that matched no rows is reported as a failure
    // rather than leaving the UI claiming a save that never happened.
    const { data, error: updateError } = await supabase
      .from("challenges")
      .update(values)
      .eq("id", id)
      .select();

    if (updateError) {
      console.error("[DayForge] failed to update challenge:", updateError.message);
      throw new Error("Could not save the challenge. Please try again.");
    }

    if (!data || data.length === 0) {
      console.error("[DayForge] challenge update matched no rows:", id);
      throw new Error("This challenge no longer exists. It may have been deleted elsewhere.");
    }

    const saved = data[0] as Challenge;
    setChallenges((prev) => prev.map((item) => (item.id === id ? saved : item)));
    return saved;
  }, []);

  /** Deletes a challenge; its check-ins cascade away in the database. */
  const deleteChallenge = useCallback(async (id: string) => {
    const supabase = createClient();

    const { data, error: deleteError } = await supabase
      .from("challenges")
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError) {
      console.error("[DayForge] failed to delete challenge:", deleteError.message);
      throw new Error("Could not delete the challenge. Please try again.");
    }

    if (!data || data.length === 0) {
      console.error("[DayForge] challenge delete matched no rows:", id);
      throw new Error("This challenge no longer exists. It may have been deleted elsewhere.");
    }

    setChallenges((prev) => prev.filter((item) => item.id !== id));
    setCheckins((prev) => prev.filter((checkin) => checkin.challenge_id !== id));
  }, []);

  /**
   * Records today's check-in for a challenge.
   *
   * An upsert on (challenge_id, log_date) keeps "one check-in per day" true, so
   * pressing the button twice can only ever restore the same row.
   */
  const checkInToday = useCallback(async (challenge: Challenge) => {
    const supabase = createClient();
    const date = todayKey();

    const { data, error: upsertError } = await supabase
      .from("challenge_checkins")
      .upsert(
        { challenge_id: challenge.id, log_date: date },
        { onConflict: "challenge_id,log_date" },
      )
      .select()
      .single();

    if (upsertError) {
      console.error("[DayForge] failed to check in:", upsertError.message);
      throw new Error("Could not save your check-in. Please try again.");
    }

    const saved = data as ChallengeCheckin;
    setCheckins((prev) => [
      ...prev.filter(
        (checkin) =>
          !(checkin.challenge_id === challenge.id && checkin.log_date === date),
      ),
      saved,
    ]);
    return saved;
  }, []);

  /** Removes today's check-in, for when it was recorded by mistake. */
  const undoCheckInToday = useCallback(async (challenge: Challenge) => {
    const supabase = createClient();
    const date = todayKey();

    const { error: deleteError } = await supabase
      .from("challenge_checkins")
      .delete()
      .eq("challenge_id", challenge.id)
      .eq("log_date", date);

    if (deleteError) {
      console.error("[DayForge] failed to undo check-in:", deleteError.message);
      throw new Error("Could not remove the check-in. Please try again.");
    }

    setCheckins((prev) =>
      prev.filter(
        (checkin) => !(checkin.challenge_id === challenge.id && checkin.log_date === date),
      ),
    );
  }, []);

  /** Challenges with their measured progress. */
  const progress: ChallengeProgress[] = useMemo(
    () =>
      challenges.map((challenge) =>
        buildChallengeProgress(challenge, {
          taskLogs,
          habitLogs,
          checkins: checkins.filter((checkin) => checkin.challenge_id === challenge.id),
          // An unfinished task with a deadline is what "task_completion" counts
          // as eligible, using the same rule as the dashboard.
          eligibleTasks: tasks.filter(isTaskEligibleToday),
        }),
      ),
    [challenges, taskLogs, habitLogs, checkins, tasks],
  );

  const checkinsByChallenge = useMemo(() => {
    const map = new Map<string, ChallengeCheckin[]>();
    for (const checkin of checkins) {
      const list = map.get(checkin.challenge_id);
      if (list) list.push(checkin);
      else map.set(checkin.challenge_id, [checkin]);
    }
    return map;
  }, [checkins]);

  return {
    challenges,
    progress,
    checkinsByChallenge,
    loading,
    error,
    reload: load,
    busyId,
    setBusyId,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    checkInToday,
    undoCheckInToday,
  };
}
