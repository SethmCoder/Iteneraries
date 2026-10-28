import type { BookingStatus } from "@/types/database";

export function bookingStatusLabel(status: BookingStatus) {
  switch (status) {
    case "needs_booking":
      return "Needs booking";
    case "in_progress":
      return "In progress";
    case "booked":
      return "Booked";
    case "skipped":
      return "Skipped";
    default:
      return status;
  }
}

export function bookingStatusClass(status: BookingStatus) {
  switch (status) {
    case "needs_booking":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "in_progress":
      return "bg-brand-light text-brand border-brand/20";
    case "booked":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "skipped":
      return "bg-gray-100 text-muted border-border";
    default:
      return "bg-gray-100 text-muted border-border";
  }
}
