import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--page-bg)] px-4">
      <AppLogo />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted">The page you requested does not exist.</p>
      <Button asChild>
        <Link href="/trips">Go to trips</Link>
      </Button>
    </div>
  );
}
