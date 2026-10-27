"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/trips";
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoPassword, setDemoPassword] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    if (!isSupabaseConfigured()) {
      if (demoModeEnabled) {
        setError(
          "Supabase is not connected. Use Preview login below to browse the UI.",
        );
        return;
      }
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (authError) {
        setError("Invalid email or password.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    }
  }

  async function enterPreview() {
    setError(null);
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: demoPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Unable to enter preview.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Unable to enter preview.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Log In"}
        </Button>
      </form>

      {demoModeEnabled ? (
        <div className="space-y-3 rounded-[12px] border border-border bg-[var(--page-bg)] p-4">
          <div>
            <p className="text-sm font-semibold">Preview without Supabase</p>
            <p className="mt-1 text-xs text-muted">
              Browse the live UI with sample trip data. Nothing is saved.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-password">Preview password</Label>
            <Input
              id="demo-password"
              type="password"
              value={demoPassword}
              onChange={(e) => setDemoPassword(e.target.value)}
              placeholder="Leave blank if no DEMO_PASSWORD is set"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={demoLoading}
            onClick={() => void enterPreview()}
          >
            {demoLoading ? "Opening preview…" : "Enter preview"}
          </Button>
        </div>
      ) : null}

      <div className="relative my-2">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted">
          New to {APP_NAME}?
        </span>
      </div>
      <Button asChild variant="secondary" className="w-full">
        <Link href="/signup">Create New Account</Link>
      </Button>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Welcome back">
          <p className="text-center text-muted">Loading…</p>
        </AuthCard>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
