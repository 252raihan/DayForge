// Stroke icons for the authentication screens.
//
// The project deliberately ships no icon package (see components/icons.tsx), so
// these are inlined the same way: a small map of paths drawn with
// `currentColor`. Only the icons the auth screens need live here.

export type AuthIconName =
  | "mail"
  | "lock"
  | "eye"
  | "eyeOff"
  | "checkCircle"
  | "flame"
  | "calendar"
  | "trend"
  | "sparkles"
  | "arrowRight";

const PATHS: Record<AuthIconName, React.ReactNode> = {
  mail: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 7 7.6 5.2a1.6 1.6 0 0 0 1.8 0L20.5 7" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" />
      <path d="M12 15v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3" />
      <path d="M6.4 7.9A17 17 0 0 0 2.5 12S6 18 12 18a9.4 9.4 0 0 0 3.6-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </>
  ),
  flame: (
    <path d="M12 3.2c3 3.4 5.5 6.1 5.5 9.3a5.5 5.5 0 0 1-11 0c0-3.2 2.5-5.9 5.5-9.3z" />
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2.8v3.4" />
      <path d="M16 2.8v3.4" />
    </>
  ),
  trend: (
    <>
      <path d="m3 16.5 5.5-5.5 3.5 3.5L21 5.5" />
      <path d="M15.5 5.5H21v5.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.6 8l4.4 1.6-4.4 1.6L12 15.6l-1.6-4.4L6 9.6 10.4 8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
    </>
  ),
};

export function AuthIcon({
  name,
  className = "h-4 w-4",
  strokeWidth = 1.75,
}: {
  name: AuthIconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
