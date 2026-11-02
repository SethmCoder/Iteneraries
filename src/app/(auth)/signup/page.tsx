import { SignupForm } from "@/components/auth/signup-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SignupPage() {
  return <SignupForm supabaseConfigured={isSupabaseConfigured()} />;
}
