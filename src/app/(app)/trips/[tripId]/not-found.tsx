import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TripNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <h1 className="text-2xl font-bold">Trip not found</h1>
      <p className="text-sm text-muted">
        This trip does not exist or you do not have access.
      </p>
      <Button asChild>
        <Link href="/trips">Back to trips</Link>
      </Button>
    </div>
  );
}
