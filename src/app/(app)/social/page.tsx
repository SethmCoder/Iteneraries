import { SocialWorkspace } from "@/components/social/social-workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Social" };

export default async function SocialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: friendships } = await supabase
    .from("friends")
    .select("*")
    .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  const profileIds = new Set<string>();
  for (const f of friendships ?? []) {
    profileIds.add(f.requester_id);
    profileIds.add(f.recipient_id);
  }
  profileIds.delete(user!.id);

  const { data: profiles } = profileIds.size
    ? await supabase
        .from("profiles")
        .select("*")
        .in("id", [...profileIds])
    : { data: [] };

  const { data: invitations } = await supabase
    .from("trip_members")
    .select("*, trips:trip_id(id, name, destination_name)")
    .eq("user_id", user!.id)
    .eq("invitation_status", "pending");

  return (
    <SocialWorkspace
      currentUserId={user!.id}
      friendships={friendships ?? []}
      profiles={profiles ?? []}
      invitations={(invitations ?? []) as never[]}
    />
  );
}
