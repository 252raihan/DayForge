"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayKey } from "@/hooks/useTasks";
import { buildHabitStats } from "@/lib/habit-utils";
import type { Habit, HabitInsert, HabitLog, HabitStats, HabitUpdate } from "@/types";

// Habits data access, in the same shape as useTasks/useNotes/useChallenges.
//
// Check-ins are date-specific rows in `habit_logs`, deliberately NOT a boolean
// on the habit itself: that is what makes a real streak, a real history and
// "did I do it on Tuesday?" answerable. Only positive check-ins are stored, so
// an unanswered day and a missed day are different things.

/** How many days the habit history strip plots. */
export const HABIT_CHART_DAYS = 14;

export function useHabits(weekStart: number = 1) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const [habitsResult, logsResult] = await Promise.all([
      supabase.from("habits").select("*").order("created_at", { ascending: true }),
      supabase.from("habit_logs").select("*").order("log_date", { ascending: true }),
    ]);

    const failure = habitsResult.error ?? logsResult.error;
    if (failure) {
      console.error("[DayForge] failed to load habits:", failure.message);
      setError(failure.message);
      setLoading(false);
      return;
    }

    setHabits((habitsResult.data as Habit[]) ?? []);
    setLogs((logsResult.data as HabitLog[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createHabit = useCallback(async (values: HabitInsert) => {
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from("habits")
      .insert(values)
      .select()
      .single();

    if (insertError) {
      console.error("[DayForge] failed to create habit:", insertError.message);
      throw new Error("Could not save the habit. Please try again.");
    }

    const created = data as Habit;
    setHabits((prev) => [...prev, created]);
    return created;
  }, []);

  const updateHabit = useCallback(async (id: string, values: HabitUpdate) => {
    const supabase = createClient();

    // `.select()` so a write that matched no rows is reported as a failure
    // rather than leaving the UI claiming a save the database never stored.
    const { data, error: updateError } = await supabase
      .from("habits")
      .update(values)
      .eq("id", id)
      .select();

    if (updateError) {
      console.error("[DayForge] failed to update habit:", updateError.message);
      throw new Error("Could not update the habit. Please try again.");
    }

    if (!data || data.length === 0) {
      console.error("[DayForge] habit update matched no rows:", id);
      throw new Error("This habit no longer exists. It may have been deleted elsewhere.");
    }

    const saved = data[0] as Habit;
    setHabits((prev) => prev.map((habit) => (habit.id === id ? saved : habit)));
    return saved;
  }, []);

  /** Deletes a habit; its check-in history cascades away in the database. */
  const deleteHabit = useCallback(async (id: string) => {
    const supabase = createClient();

    const { data, error: deleteError } = await supabase
      .from("habits")
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError) {
      console.error("[DayForge] failed to delete habit:", deleteError.message);
      throw new Error("Could not delete the habit. Please try again.");
    }

    if (!data || data.length === 0) {
      console.error("[DayForge] habit delete matched no rows:", id);
      throw new Error("This habit no longer exists. It may have been deleted elsewhere.");
    }

    setHabits((prev) => prev.filter((habit) => habit.id !== id));
    setLogs((prev) => prev.filter((log) => log.habit_id !== id));
  }, []);

  /**
   * Records a check-in for a specific day.
   *
   * The upsert is keyed on (habit_id, log_date), which is a unique index in the
   * database, so pressing the button twice - or two tabs racing - updates the
   * same row instead of stacking duplicates.
   */
  const setCheckIn = useCallback(
    async (habit: Habit, done: boolean, date: string = todayKey()) => {
      const supabase = createClient();

      if (!done) {
        // Un-checking removes the row: only positive check-ins are stored.
        const { error: deleteError } = await supabase
          .from("habit_logs")
          .delete()
          .eq("habit_id", habit.id)
          .eq("log_date", date);

        if (deleteError) {
          console.error("[DayForge] failed to clear habit check-in:", deleteError.message);
          throw new Error("Could not update this day. Please try again.");
        }

        setLogs((prev) =>
          prev.filter((log) => !(log.habit_id === habit.id && log.log_date === date)),
        );
        return;
      }

      const { data, error: upsertError } = await supabase
        .from("habit_logs")
        .upsert(
          { habit_id: habit.id, log_date: date, done: true },
          { onConflict: "habit_id,log_date" },
        )
        .select()
        .single();

      if (upsertError) {
        console.error("[DayForge] failed to save habit check-in:", upsertError.message);
        throw new Error("Could not save this day. Please try again.");
      }

      const saved = data as HabitLog;
      setLogs((prev) => [
        ...prev.filter(
          (log) => !(log.habit_id === habit.id && log.log_date === date),
        ),
        saved,
      ]);
    },
    [],
  );

  const stats: HabitStats[] = useMemo(
    () =>
      habits.map((habit) =>
        buildHabitStats(
          habit,
          logs.filter((log) => log.habit_id === habit.id),
          weekStart,
          HABIT_CHART_DAYS,
        ),
      ),
    [habits, logs, weekStart],
  );

  const visibleStats = useMemo(
    () => (includeArchived ? stats : stats.filter((item) => !item.habit.archived)),
    [stats, includeArchived],
  );

  /**
   * Which habits are answerable today, in the order they should be answered:
   * un-done first, then done, then anything not scheduled for today.
   */
  const checkinOrder = useMemo(() => {
    const today = todayKey();
    return [...visibleStats].sort((a, b) => rank(a) - rank(b));

    function rank(item: HabitStats): number {
      if (!item.dueToday) return 2;
      const log = item.recent[HABIT_CHART_DAYS - 1];
      return log?.log_date === today ? 1 : 0;
    }
  }, [visibleStats]);

  const todayStats = checkinOrder.filter((item) => item.dueToday);
  const doneToday = todayStats.filter(
    (item) => item.recent[HABIT_CHART_DAYS - 1] !== null,
  ).length;

  return {
    stats: checkinOrder,
    todayStats,
    doneToday,
    includeArchived,
    setIncludeArchived,
    loading,
    error,
    reload: load,
    busyId,
    setBusyId,
    createHabit,
    updateHabit,
    deleteHabit,
    setCheckIn,
  };
}
