// Minimal inline SVG icon set (stroke-based, inherits `currentColor`).
// Inlined instead of pulling in an icon package: no extra dependency, and the
// icons stay easy to restyle. Add new ones to the map below.
import type { IconName } from "@/lib/nav";

type IconProps = {
  name: IconName;
  className?: string;
};

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  tasks: (
    <>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="m3 6 1.5 1.5L7 5" />
      <path d="m3 12 1.5 1.5L7 11" />
      <path d="m3 18 1.5 1.5L7 17" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
    </>
  ),
  notes: (
    <>
      <path d="M5 3.5h9.5L19 8v12.5H5z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12.5h7" />
      <path d="M8.5 16h5" />
    </>
  ),
  challenges: (
    <>
      <path d="M7 4h10v3a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v1.5a3 3 0 0 1-3 2.9" />
      <path d="M7 5H4v1.5a3 3 0 0 0 3 2.9" />
      <path d="M12 12v4" />
      <path d="M8.5 20h7l-.8-4h-5.4z" />
    </>
  ),
  habits: (
    <>
      <path d="M12 3.5c3 3.4 5.5 6.1 5.5 9.3a5.5 5.5 0 0 1-11 0c0-3.2 2.5-5.9 5.5-9.3z" />
      <path d="M12 17.5a2.5 2.5 0 0 1-2.5-2.5c0-1.3 1.1-2.6 2.5-4.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 2.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9.7 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21.4 11a2 2 0 1 1 0 4z" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
