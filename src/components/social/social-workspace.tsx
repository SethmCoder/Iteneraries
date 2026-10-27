"use client";

import { useState } from "react";
import {
  removeFriendAction,
  respondFriendRequestAction,
  respondInvitationAction,
  searchUsersAction,
  sendFriendRequestAction,
} from "@/app/actions/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Friend, Profile } from "@/types/database";

type Invitation = {
  id: string;
  role: string;
  trips: { id: string; name: string | null; destination_name: string | null } | null;
};

export function SocialWorkspace({
  currentUserId,
  friendships,
  profiles,
  invitations,
}: {
  currentUserId: string;
  friendships: Friend[];
  profiles: Profile[];
  invitations: Invitation[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; username: string; avatar_url: string | null }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const friends = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter(
    (f) => f.status === "pending" && f.recipient_id === currentUserId,
  );
  const outgoing = friendships.filter(
    (f) => f.status === "pending" && f.requester_id === currentUserId,
  );

  async function search() {
    setError(null);
    try {
      setResults(await searchUsersAction(query));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social</h1>
        <p className="text-sm text-muted">
          Manage friends and trip invitations.
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
        <h2 className="font-semibold">Find friends</h2>
        <div className="mt-2 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username"
            onKeyDown={(e) => e.key === "Enter" && void search()}
          />
          <Button onClick={() => void search()}>Search</Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <ul className="mt-3 space-y-2">
          {results.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{u.username}</span>
              </div>
              <Button
                size="sm"
                onClick={() => void sendFriendRequestAction(u.username)}
              >
                Add friend
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Friends</h2>
          {friends.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No friends yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {friends.map((f) => {
                const otherId =
                  f.requester_id === currentUserId
                    ? f.recipient_id
                    : f.requester_id;
                const p = byId[otherId];
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p?.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {(p?.username ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {p?.username ?? "Unknown"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void removeFriendAction(f.id)}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Friend requests</h2>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Incoming</p>
              {incoming.length === 0 ? (
                <p className="mt-1 text-sm text-muted">None</p>
              ) : (
                incoming.map((f) => (
                  <div
                    key={f.id}
                    className="mt-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm">
                      {byId[f.requester_id]?.username ?? "User"}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          void respondFriendRequestAction(f.id, "accepted")
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void respondFriendRequestAction(f.id, "rejected")
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Outgoing</p>
              {outgoing.length === 0 ? (
                <p className="mt-1 text-sm text-muted">None</p>
              ) : (
                outgoing.map((f) => (
                  <p key={f.id} className="mt-1 text-sm">
                    Pending with {byId[f.recipient_id]?.username ?? "user"}
                  </p>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[12px] border border-border bg-card p-4 shadow-sm">
        <h2 className="font-semibold">Trip invitations</h2>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No pending invitations.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {inv.trips?.name || "Untitled Trip"}
                  </p>
                  <p className="text-xs text-muted">
                    {inv.trips?.destination_name || "Destination not set"} ·{" "}
                    {inv.role}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => void respondInvitationAction(inv.id, "accepted")}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void respondInvitationAction(inv.id, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
