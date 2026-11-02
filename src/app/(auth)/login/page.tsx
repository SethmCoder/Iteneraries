import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const supabaseConfigured = isSupabaseConfigured();
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
        supabaseConfigured={supabaseConfigured}
        demoModeEnabled={demoModeEnabled}
      />
    </Suspense>
  );
}
