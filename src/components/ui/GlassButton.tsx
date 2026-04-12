import clsx from "clsx";

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "success";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

const variants = {
  primary:
    "bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-300",
  secondary: "bg-white/5 hover:bg-white/10 border-white/10 text-white/70",
  danger: "bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-300",
  success:
    "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-300",
};

export function GlassButton({
  children,
  onClick,
  variant = "primary",
  className,
  disabled,
  type = "button",
}: GlassButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-xl border px-4 py-2 text-sm font-medium",
        "backdrop-blur-sm transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
