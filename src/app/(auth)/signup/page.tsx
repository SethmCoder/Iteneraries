import { SignupForm } from "@/components/auth/signup-form";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export default function SignupPage() {
  const supabase = getSupabasePublicConfig();
  return (
    <SignupForm
      supabaseConfigured={Boolean(supabase)}
      supabase={supabase}
    />
  );
}
