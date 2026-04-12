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
    "border-transparent bg-[#1387d7] text-white shadow-[0_18px_32px_rgba(19,135,215,0.24)] hover:bg-[#0e79c1]",
  secondary:
    "border-slate-200 bg-white/86 text-slate-700 hover:border-slate-300 hover:bg-white",
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
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
        "rounded-full border px-4 py-2.5 text-sm font-semibold",
        "transition-all duration-200",
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
