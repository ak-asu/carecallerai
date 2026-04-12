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
    "border-transparent bg-[#2F6DB3] text-white shadow-[0_18px_32px_rgba(47,109,179,0.24)] hover:bg-[#22558C]",
  secondary:
    "border-[#D8CCBD] bg-[#FFFDF9]/92 text-slate-700 hover:border-[#C8B5A1] hover:bg-[#FFF7F0]",
  danger:
    "border-[#E9BDC3] bg-[#FBEAEC] text-[#B04858] hover:border-[#DBA2AB] hover:bg-[#F8DEE2]",
  success:
    "border-[#C4D9C8] bg-[#E7F1EA] text-[#4F7761] hover:border-[#AFCBB5] hover:bg-[#DDEBE1]",
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
