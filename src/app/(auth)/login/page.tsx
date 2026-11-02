import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const supabase = getSupabasePublicConfig();
  const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <Suspense
      fallback={
        <AuthCard title="Welcome back">
          <p className="text-center text-muted">Loading…</p>
        </AuthCard>
      }
    >
      <LoginForm
        supabaseConfigured={Boolean(supabase)}
        supabase={supabase}
        demoModeEnabled={demoModeEnabled}
      />
    </Suspense>
  );
}
