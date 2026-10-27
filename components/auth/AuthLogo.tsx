// DayForge brand mark: a rounded indigo tile with the "D" glyph, plus the
// wordmark. Shared by the hero and the auth card so the two can never drift.

export default function AuthLogo({
  size = "md",
  className = "",
}: {
  /** `sm` for the mobile header, `md` for the hero and the card. */
  size?: "sm" | "md";
  className?: string;
}) {
  const tile = size === "sm" ? "h-9 w-9 text-base" : "h-11 w-11 text-lg";
  const word = size === "sm" ? "text-lg" : "text-xl";

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-electric-500 font-bold text-white shadow-glow ${tile}`}
        aria-hidden="true"
      >
        D
      </span>
      <span className={`font-semibold tracking-tight text-white ${word}`}>
        Day<span className="text-brand-300">Forge</span>
      </span>
    </span>
  );
}
