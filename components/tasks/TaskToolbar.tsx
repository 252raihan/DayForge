"use client";

import { ALL_CATEGORIES, ALL_STATUSES } from "@/hooks/useTasks";
import type { TaskPriority, TaskSort, TaskStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui";
import { Input, Select } from "@/components/ui/Input";
import { SearchIcon, CloseIcon } from "@/components/icons";

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
  { value: "created", label: "Created" },
];

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
  // A filter is "on" when it differs from its default; that drives the accent
  // border, so the user can see at a glance that the list is narrowed.
  const priorityOn = priority !== null;
  const categoryOn = category !== ALL_CATEGORIES;
  const statusOn = status !== ALL_STATUSES;

  return (
    <Card className="p-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {/* Search: title and description. */}
        <div className="relative lg:max-w-xs lg:flex-1">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon className="h-4 w-4" />
          </span>
          <Input
            id="task-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks…"
            className="h-8 bg-surface-2 pl-8 shadow-none"
          />
        </div>

        {/* Filters and sort. Each control has a visually-hidden label so the
            row stays compact without losing the accessible name. */}
        <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
          <FilterSelect
            id="task-filter-priority"
            label="Priority"
            value={priority ?? ""}
            on={priorityOn}
            onChange={(value) =>
              onPriorityChange(value === "" ? null : (value as TaskPriority))
            }
            options={[
              { value: "", label: "Any priority" },
              ...PRIORITY_OPTIONS,
            ]}
          />

          <FilterSelect
            id="task-filter-category"
            label="Category"
            value={category}
            on={categoryOn}
            onChange={onCategoryChange}
            options={[
              { value: ALL_CATEGORIES, label: "Any category" },
              ...categories.map((value) => ({ value, label: value })),
            ]}
          />

          <FilterSelect
            id="task-filter-status"
            label="Status"
            value={status}
            on={statusOn}
            onChange={onStatusChange}
            options={[
              { value: ALL_STATUSES, label: "Any status" },
              ...STATUS_OPTIONS,
            ]}
          />

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

          <FilterSelect
            id="task-sort"
            label="Sort by"
            value={sort}
            on={false}
            onChange={(value) => onSortChange(value as TaskSort)}
            options={SORT_OPTIONS}
          />

          {hasActiveRefinements ? (
            <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0">
              <CloseIcon className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function FilterSelect({
  id,
  label,
  value,
  on,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  on: boolean;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative shrink-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 w-auto border-transparent bg-surface-2 py-0 text-xs shadow-none ${on ? "border-accent/40 bg-accent-soft font-medium text-accent" : ""}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
