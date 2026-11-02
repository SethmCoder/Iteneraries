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

/** Mark aspect from Adobe-split waypoint-mark.svg (~1024×760). */
const sizes = {
  sm: { markW: 40, markH: 30, text: "text-base" },
  md: { markW: 52, markH: 39, text: "text-lg" },
  lg: { markW: 72, markH: 53, text: "text-2xl" },
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
  const src = inverted
    ? "/brand/waypoint-mark-inverted.svg"
    : "/brand/waypoint-mark.svg";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src={src}
        alt=""
        width={s.markW}
        height={s.markH}
        className="shrink-0 object-contain"
        unoptimized
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
