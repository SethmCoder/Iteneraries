"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, Menu, Plane, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppLogo } from "@/components/brand/app-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Notification, Profile, Trip } from "@/types/database";

type AppHeaderProps = {
  profile: Profile;
  nextTrip?: Trip | null;
};

export function AppHeader({ profile, nextTrip }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unread = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!cancelled && data) setNotifications(data);
      } catch {
        // Supabase may be unconfigured in local UI preview
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [profile.id]);

  async function markAllRead() {
    const supabase = createClient();
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    );
  }

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
      ),
    );
  }

  async function logout() {
    try {
      await fetch("/api/demo/logout", { method: "POST" });
    } catch {
      // ignore
    }
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Demo mode or missing Supabase config
    }
    router.push("/login");
    router.refresh();
  }

  const initials = (profile.username || "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-brand-hover bg-brand text-white">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 md:px-6">
        <Link href="/trips" className="shrink-0">
          <AppLogo inverted size="sm" />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {nextTrip ? (
            <Link
              href={`/trips/${nextTrip.id}`}
              className="rounded-[8px] px-3 py-1.5 text-sm font-medium text-white/90 transition-colors duration-150 hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plane className="h-4 w-4" />
                Next Trip
              </span>
            </Link>
          ) : (
            <span className="rounded-[8px] px-3 py-1.5 text-sm text-white/60">
              Next Trip
            </span>
          )}
          <Link
            href="/social"
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-white/10",
              pathname.startsWith("/social") && "bg-white/15",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Social
            </span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white hover:bg-white/10 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                <button
                  type="button"
                  className="text-xs font-medium text-brand"
                  onClick={markAllRead}
                >
                  Mark all read
                </button>
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-0.5"
                    onClick={() => {
                      void markRead(n.id);
                      if (n.type.startsWith("flight")) router.push("/flights");
                      else if (n.type.startsWith("account_"))
                        router.push("/settings?tab=account");
                      else if (n.related_trip_id)
                        router.push(`/trips/${n.related_trip_id}`);
                      else if (n.type.startsWith("friend")) router.push("/social");
                      else if (n.type.startsWith("import"))
                        router.push("/settings?tab=imports");
                    }}
                  >
                    <span className={cn("text-sm", !n.read_at && "font-semibold")}>
                      {n.message}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex items-center gap-2 rounded-[8px] px-2 py-1 transition-colors duration-150 hover:bg-white/10"
              >
                <span className="hidden text-sm font-medium sm:inline">
                  {profile.username}
                </span>
                <Avatar className="h-8 w-8 border-white/30">
                  <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-white/20 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push("/trips")}>
                Main Page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/flights")}>
                <Plane className="mr-2 h-4 w-4" />
                Flights Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/hotels")}>
                <Building2 className="mr-2 h-4 w-4" />
                Hotels Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/social")}>
                Friends
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {nextTrip ? (
              <Link
                href={`/trips/${nextTrip.id}`}
                className="rounded-[8px] px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
              >
                Next Trip
              </Link>
            ) : null}
            <Link
              href="/social"
              className="rounded-[8px] px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              Social
            </Link>
            <Link
              href="/flights"
              className="rounded-[8px] px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              Flights Pending
            </Link>
            <Link
              href="/hotels"
              className="rounded-[8px] px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              Hotels Pending
            </Link>
            <Link
              href="/settings"
              className="rounded-[8px] px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              Settings
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
