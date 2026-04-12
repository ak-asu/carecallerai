import clsx from "clsx";

interface GlassBadgeProps {
  children: React.ReactNode;
  color?: "blue" | "emerald" | "amber" | "red" | "purple" | "cyan";
  className?: string;
}

const colors = {
  blue: "border-[#BFD2E9] bg-[#EEF4FB] text-[#2F6DB3]",
  emerald: "border-[#C4D9C8] bg-[#E7F1EA] text-[#5F8B73]",
  amber: "border-[#E9D2B2] bg-[#F8EDD8] text-[#B9772E]",
  red: "border-[#E9BDC3] bg-[#FBEAEC] text-[#C84C5E]",
  purple: "border-[#D8CBE3] bg-[#F3EDF8] text-[#7A5D96]",
  cyan: "border-[#CFE1E3] bg-[#EAF3F4] text-[#4C7F86]",
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
