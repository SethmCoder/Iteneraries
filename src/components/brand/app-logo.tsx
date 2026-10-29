import Image from "next/image";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  showWordmark?: boolean;
  inverted?: boolean;
  size?: "sm" | "md" | "lg";
  wordmarkClassName?: string;
};

const sizes = {
  sm: { mark: 34, text: "text-base" },
  md: { mark: 44, text: "text-lg" },
  lg: { mark: 58, text: "text-2xl" },
};

export function AppLogo({
  className,
  showWordmark = true,
  inverted = false,
  size = "md",
  wordmarkClassName,
}: AppLogoProps) {
  const s = sizes[size];
  const textColor = inverted ? "text-white" : "text-[#0F3A45]";
  const markSrc = inverted
    ? "/brand/waypoint-mark-inverted.png"
    : "/brand/waypoint-mark.png";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src={markSrc}
        alt=""
        width={s.mark}
        height={s.mark}
        className="shrink-0 object-contain"
        priority
      />
      {showWordmark ? (
        <span
          className={cn(
            "font-bold tracking-tight",
            s.text,
            textColor,
            wordmarkClassName,
          )}
        >
          {APP_NAME}
        </span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </div>
  );
}
