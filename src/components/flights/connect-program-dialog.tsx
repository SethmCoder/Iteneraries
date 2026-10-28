"use client";

import { useEffect, useState, useTransition } from "react";
import {
  linkLoyaltyProgramAction,
  syncLoyaltyProgramAction,
} from "@/app/actions/loyalty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOYALTY_PROGRAMS } from "@/lib/flights/loyalty-programs";

export function ConnectProgramDialog({
  open,
  onOpenChange,
  initialProgram,
  mode = "link",
  webParseConfigured,
  disabled,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProgram: string;
  mode?: "link" | "sync";
  webParseConfigured: boolean;
  disabled?: boolean;
  onLinked: (result: { program: string; balance: number }) => void;
}) {
  const [program, setProgram] = useState(initialProgram);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setProgram(initialProgram);
  }, [open, initialProgram]);

  const label =
    LOYALTY_PROGRAMS.find((p) => p.id === program)?.label ?? program;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPassword("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "sync" ? "Sync" : "Connect"} {label}
          </DialogTitle>
          <DialogDescription>
            Paid AwardWallet Web Parsing only. Prefer free AwardWallet OAuth or
            manual balances. Credentials are relayed once and never stored.
          </DialogDescription>
        </DialogHeader>

        {!webParseConfigured ? (
          <p className="text-sm text-muted">
            This optional paid API is not configured. Use{" "}
            <strong>Connect AwardWallet (free)</strong> or enter a balance
            manually instead.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="connect-program">Program</Label>
              <select
                id="connect-program"
                className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                value={program}
                disabled={mode === "sync" || pending}
                onChange={(e) => setProgram(e.target.value)}
              >
                {LOYALTY_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="connect-user">Username / member number</Label>
              <Input
                id="connect-user"
                autoComplete="username"
                value={username}
                disabled={pending || disabled}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="connect-pass">Password</Label>
              <Input
                id="connect-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={pending || disabled}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pending || disabled || !username.trim() || !password}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      const action =
                        mode === "sync"
                          ? syncLoyaltyProgramAction
                          : linkLoyaltyProgramAction;
                      const result = await action({
                        program,
                        username,
                        password,
                      });
                      setPassword("");
                      setUsername("");
                      onOpenChange(false);
                      onLinked(result);
                    } catch (e) {
                      setPassword("");
                      setError((e as Error).message);
                    }
                  });
                }}
              >
                {pending ? "Checking…" : mode === "sync" ? "Sync balance" : "Connect"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
