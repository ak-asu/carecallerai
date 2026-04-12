import clsx from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className, glow }: GlassCardProps) {
  return (
    <div
      className={clsx(
        "surface-card rounded-[2rem] p-5 md:p-6 transition-all duration-300",
        glow &&
          "shadow-[0_28px_80px_rgba(197,107,66,0.14)] border-[#E3B9A6]/70",
        className,
      )}
    >
      {children}
    </div>
  );
}
