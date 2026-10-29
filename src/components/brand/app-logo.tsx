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
  sm: { markW: 36, markH: 28, text: "text-base" },
  md: { markW: 48, markH: 37, text: "text-lg" },
  lg: { markW: 64, markH: 50, text: "text-2xl" },
};

/**
 * Crisp SVG flight-path mark for header/login.
 * Favicon stays on the PNG asset; this avoids pixelation + white-box artifacts.
 */
function FlightPathMark({
  width,
  height,
  inverted,
}: {
  width: number;
  height: number;
  inverted?: boolean;
}) {
  const primary = inverted ? "#FFFFFF" : "#176B87";
  const accent = "#E9B44C";
  const plane = inverted ? "#FFFFFF" : "#176B87";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 80 62"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Outer Ocean Blue crescent — thick left bend, tapers toward plane */}
      <path
        fill={primary}
        d="M14 54
           C 6 46, 5 30, 14 18
           C 22 8, 38 5, 52 12
           C 56 14, 59 17, 61 20
           C 58.5 21.5, 55.5 20.5, 52.5 19
           C 41 13.5, 28.5 15.5, 22 23
           C 15.5 30.5, 15.5 41.5, 20.5 48.5
           C 18 50.5, 16 52.5, 14 54 Z"
      />
      {/* Amber inner trail */}
      <path
        fill={accent}
        d="M21 51
           C 16 44.5, 15.5 34, 21.5 26.5
           C 26.5 20.5, 36.5 18, 45 21.5
           C 47.5 22.5, 49.5 24, 51 25.5
           C 49 26.5, 47 25.5, 45 24.5
           C 38 21.5, 30.5 23, 26.5 28
           C 22 34, 22 41.5, 25.5 46.5
           C 24 48, 22.5 49.5, 21 51 Z"
      />
      {/* Airplane at path end */}
      <g transform="translate(64 18) rotate(-38)">
        <path
          fill={plane}
          d="M12 0
             L3.5 2
             L-2.2 8.8
             L-4.8 7
             L1.2 2
             L-6 1.2
             L-8.5 5
             L-10.8 3.2
             L-8.6 0.6
             L-12.5 0
             L-8.6 -0.6
             L-10.8 -3.2
             L-8.5 -5
             L-6 -1.2
             L1.2 -2
             L-4.8 -7
             L-2.2 -8.8
             L3.5 -2
             Z"
        />
      </g>
    </svg>
  );
}

export function AppLogo({
  className,
  showWordmark = true,
  inverted = false,
  size = "md",
  wordmarkClassName,
}: AppLogoProps) {
  const s = sizes[size];
  const textColor = inverted ? "text-white" : "text-[#0F3A45]";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <FlightPathMark width={s.markW} height={s.markH} inverted={inverted} />
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
