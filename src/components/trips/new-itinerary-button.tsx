"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewItineraryButton({
  className,
  label = "New Itinerary",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Button className={className} asChild>
      <Link href="/trips/new">
        <Plus className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
