import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  showWordmark?: boolean;
  inverted?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { mark: 24, text: "text-base" },
  md: { mark: 32, text: "text-lg" },
  lg: { mark: 40, text: "text-xl" },
};

export function AppLogo({
  className,
  showWordmark = true,
  inverted = false,
  size = "md",
}: AppLogoProps) {
  const s = sizes[size];
  const markColor = inverted ? "#FFFFFF" : "#1616C9";
  const textColor = inverted ? "text-white" : "text-brand";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="18" stroke={markColor} strokeWidth="2.5" />
        <circle cx="20" cy="20" r="3" fill={markColor} />
        <path
          d="M20 6 L22.5 17.5 L20 16 L17.5 17.5 Z"
          fill={markColor}
        />
        <path
          d="M20 34 L17.5 22.5 L20 24 L22.5 22.5 Z"
          fill={markColor}
          opacity="0.45"
        />
        <path
          d="M6 20 L17.5 17.5 L16 20 L17.5 22.5 Z"
          fill={markColor}
          opacity="0.7"
        />
        <path
          d="M34 20 L22.5 22.5 L24 20 L22.5 17.5 Z"
          fill={markColor}
          opacity="0.7"
        />
        <circle cx="20" cy="6" r="1.5" fill={markColor} />
      </svg>
      {showWordmark ? (
        <span className={cn("font-bold tracking-tight", s.text, textColor)}>
          {APP_NAME}
        </span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </div>
  );
}
