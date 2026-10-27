import Link from "next/link";
import { MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateRange } from "@/lib/utils";
import type { Profile, Trip } from "@/types/database";

type TripCardProps = {
  trip: Trip;
  collaborators?: Profile[];
  selected?: boolean;
  onHover?: () => void;
};

export function TripCard({
  trip,
  collaborators = [],
  selected,
  onHover,
}: TripCardProps) {
  const title = trip.name?.trim() || "Untitled Trip";
  const city = trip.destination_name?.trim() || "Destination not set";

  return (
    <Link
      href={`/trips/${trip.id}`}
      onMouseEnter={onHover}
      className={`flex gap-3 rounded-[12px] border bg-card p-3 shadow-sm transition-colors duration-150 hover:border-brand ${
        selected ? "border-brand bg-brand-light" : "border-border"
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[var(--page-bg)]">
        {trip.destination_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trip.destination_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <MapPin className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{city}</p>
        <p className="truncate text-sm text-muted">{title}</p>
        <p className="mt-1 text-xs text-muted">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>
        {collaborators.length > 0 ? (
          <div className="mt-2 flex -space-x-2">
            {collaborators.slice(0, 4).map((c) => (
              <Avatar key={c.id} className="h-6 w-6 border-2 border-white">
                <AvatarImage src={c.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {c.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
