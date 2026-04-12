import clsx from "clsx";

interface GlassBadgeProps {
  children: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "red" | "purple" | "cyan";
  className?: string;
}

const colors = {
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  purple: "border-violet-200 bg-violet-50 text-violet-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
};

export function GlassBadge({
  children,
  color = "blue",
  className,
}: GlassBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em]",
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
