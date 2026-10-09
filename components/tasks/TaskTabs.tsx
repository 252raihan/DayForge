"use client";

import type { TaskFilter } from "@/types";

// Tab bar for the task list. Each tab shows a count so an empty-looking tab is
// still visibly populated.
const TABS: { key: TaskFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All" },
];

export default function TaskTabs({
  active,
  onChange,
  counts,
}: {
  active: TaskFilter;
  onChange: (filter: TaskFilter) => void;
  counts: Record<TaskFilter, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter tasks"
      className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
    >
      {TABS.map((tab) => {
        const selected = active === tab.key;
        // Overdue gets a red count pill, so a backlog is visible from any tab.
        const countTone =
          tab.key === "overdue" && counts.overdue > 0
            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            : selected
              ? "bg-accent text-white"
              : "bg-app text-muted";

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${selected
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-accent-soft/50 hover:text-accent"
              }`}
          >
            {tab.label}
            <span
              className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${countTone}`}
            >
              {counts[tab.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
