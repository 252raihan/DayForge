"use client";

import { ALL_CATEGORIES, ALL_STATUSES } from "@/hooks/useTasks";
import type { TaskPriority, TaskSort, TaskStatus } from "@/types";

// The toolbar above the task list: search, the three filters and the sort order.
//
// It is fully controlled - every value and setter comes from useTasks, so the
// toolbar never keeps its own copy of the state and the list, the tab counts and
// the Dashboard all stay in step.
//
// The search input is intentionally bound to the *undebounced* value so typing
// stays responsive; useTasks debounces it by 300ms before filtering.

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created date" },
];

// Shared styling so the three selects and the search box line up.
const CONTROL_CLASS =
  "rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40";

export default function TaskToolbar({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  categories,
  hasActiveRefinements,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  priority: TaskPriority | null;
  onPriorityChange: (value: TaskPriority | null) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  sort: TaskSort;
  onSortChange: (value: TaskSort) => void;
  /** Categories present in the current data, for the dropdown. */
  categories: string[];
  hasActiveRefinements: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search: title and description. */}
        <div className="relative lg:max-w-xs lg:flex-1">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="task-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title or description..."
            className={`${CONTROL_CLASS} w-full pl-9`}
          />
        </div>

        {/* Filters and sort. Each has a visible label for accessibility. */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium">Priority</span>
            <select
              value={priority ?? ""}
              onChange={(e) =>
                onPriorityChange(e.target.value === "" ? null : (e.target.value as TaskPriority))
              }
              className={CONTROL_CLASS}
            >
              <option value="">Any</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium">Category</span>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className={CONTROL_CLASS}
            >
              <option value={ALL_CATEGORIES}>Any</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium">Status</span>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className={CONTROL_CLASS}
            >
              <option value={ALL_STATUSES}>Any</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium">Sort by</span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as TaskSort)}
              className={CONTROL_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* Only offered once something is actually narrowing the list. */}
          {hasActiveRefinements ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}