import Link from "next/link";
import { cn } from "@/lib/cn";
import { ChevronRightIcon } from "@/components/icons";

// The quiet "View all →" affordance used in card headers and list footers.
// Kept as one component so its weight, colour and hover behave identically on
// every page, instead of each panel inventing its own link style.

export default function CardLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted transition-colors hover:text-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    >
      {children}
      <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
