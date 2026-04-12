import clsx from "clsx";

interface GlassBadgeProps {
  children: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "red" | "purple" | "cyan";
  className?: string;
}

const colors = {
  blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  red: "bg-red-500/20 text-red-300 border-red-500/30",
  purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

export function GlassBadge({
  children,
  color = "blue",
  className,
}: GlassBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
