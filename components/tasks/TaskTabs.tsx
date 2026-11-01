"use client";

import type { TaskFilter } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

// Tab bar for the task list. Each tab shows a count so an empty-looking tab is
// still visibly populated. Overdue keeps a red count pill, so a backlog is
// visible from any tab without colouring the whole row.
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
  className,
}: {
  active: TaskFilter;
  onChange: (filter: TaskFilter) => void;
  counts: Record<TaskFilter, number>;
  className?: string;
}) {
  return (
    <SegmentedControl
      ariaLabel="Filter tasks"
      value={active}
      onChange={onChange}
      className={className}
      options={TABS.map((tab) => {
        const overdue = tab.key === "overdue" && counts.overdue > 0;
        return {
          value: tab.key,
          label: tab.label,
          badge: (
            <Badge
              tone={overdue ? "danger" : "neutral"}
              className="border-transparent bg-transparent px-1 text-2xs"
            >
              {counts[tab.key]}
            </Badge>
          ),
        };
      })}
    />
  );
}
