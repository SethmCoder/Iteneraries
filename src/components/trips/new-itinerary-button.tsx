"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { createTripAction } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";

export function NewItineraryButton({
  className,
  label = "New Itinerary",
}: {
  className?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className={className}
      disabled={pending}
      onClick={() => startTransition(() => createTripAction())}
    >
      <Plus className="h-4 w-4" />
      {pending ? "Creating…" : label}
    </Button>
  );
}
