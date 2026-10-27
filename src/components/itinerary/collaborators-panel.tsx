"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { inviteCollaboratorAction, respondInvitationAction, removeCollaboratorAction } from "@/app/actions/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Profile, TripMember, TripRole } from "@/types/database";

export function CollaboratorsPanel({
  tripId,
  members,
  role,
  currentUserId,
}: {
  tripId: string;
  members: (TripMember & { profiles: Profile | null })[];
  role: TripRole;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function invite() {
    setError(null);
    setMessage(null);
    try {
      await inviteCollaboratorAction({
        tripId,
        username: username.trim(),
        role: inviteRole,
      });
      setMessage("Invitation sent");
      setUsername("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Users className="h-4 w-4" />
          Collaborators
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trip collaborators</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {(m.profiles?.username ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">
                    {m.profiles?.username ?? "Unknown"}
                  </p>
                  <p className="text-xs capitalize text-muted">
                    {m.role} · {m.invitation_status}
                  </p>
                </div>
              </div>
              {role === "owner" && m.user_id !== currentUserId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => void removeCollaboratorAction(tripId, m.id)}
                >
                  Remove
                </Button>
              ) : null}
              {m.user_id === currentUserId && m.invitation_status === "pending" ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() =>
                      void respondInvitationAction(m.id, "accepted")
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void respondInvitationAction(m.id, "declined")
                    }
                  >
                    Decline
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {role === "owner" ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Invite a friend</p>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-[8px] border border-input px-3 text-sm"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "editor" | "viewer")
              }
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button onClick={() => void invite()} className="w-full">
              Send invitation
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
