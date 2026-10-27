import { AppLogo } from "@/components/brand/app-logo";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 py-10">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-[12px] border border-border bg-card shadow-sm",
          className,
        )}
      >
        <div className="h-1.5 w-full bg-brand" />
        <div className="space-y-6 p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AppLogo size="lg" />
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
