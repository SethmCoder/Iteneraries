import { SavedPlacesWorkspace } from "@/components/saved-places/saved-places-workspace";
import { hasDemoSession, isDemoModeEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { Place, PlaceList, PlaceListItem, PlaceListShare } from "@/types/database";

export const metadata = { title: "Saved Places" };

type ListBundle = PlaceList & {
  items: (PlaceListItem & { places: Place | null })[];
  shares: PlaceListShare[];
  isSharedWithMe?: boolean;
};

export default async function SavedPlacesPage() {
  if (isDemoModeEnabled() && (await hasDemoSession())) {
    return (
      <SavedPlacesWorkspace lists={[]} sharedLists={[]} friends={[]} trips={[]} />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ownLists } = await supabase
    .from("place_lists")
    .select("*")
    .eq("owner_id", user!.id)
    .order("updated_at", { ascending: false });

  const { data: shareRows } = await supabase
    .from("place_list_shares")
    .select("list_id, permission")
    .eq("friend_user_id", user!.id);

  const sharedListIds = (shareRows ?? []).map((s) => s.list_id as string);
  let sharedListsRaw: PlaceList[] = [];
  if (sharedListIds.length) {
    const { data } = await supabase
      .from("place_lists")
      .select("*")
      .in("id", sharedListIds);
    sharedListsRaw = (data ?? []) as PlaceList[];
  }

  async function loadBundle(list: PlaceList, shared?: boolean): Promise<ListBundle> {
    const [{ data: items }, { data: shares }] = await Promise.all([
      supabase
        .from("place_list_items")
        .select("*, places(*)")
        .eq("list_id", list.id)
        .order("created_at", { ascending: false }),
      supabase.from("place_list_shares").select("*").eq("list_id", list.id),
    ]);
    const normalized = ((items ?? []) as (PlaceListItem & {
      places: Place | Place[] | null;
    })[]).map((row) => ({
      ...row,
      places: Array.isArray(row.places) ? row.places[0] ?? null : row.places,
    }));
    return {
      ...list,
      items: normalized,
      shares: (shares ?? []) as PlaceListShare[],
      isSharedWithMe: shared,
    };
  }

  const lists = await Promise.all(
    ((ownLists ?? []) as PlaceList[]).map((l) => loadBundle(l)),
  );
  const sharedLists = await Promise.all(
    sharedListsRaw.map((l) => loadBundle(l, true)),
  );

  const { data: friendships } = await supabase
    .from("friends")
    .select("*")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`);

  const friendIds = (friendships ?? []).map((f) =>
    f.requester_id === user!.id ? f.recipient_id : f.requester_id,
  );
  let friends: Array<{
    id: string;
    username: string;
    display_name: string | null;
  }> = [];
  if (friendIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", friendIds);
    friends = data ?? [];
  }

  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("trip_id, trips:trip_id(id, name, destination_name)")
    .eq("user_id", user!.id)
    .eq("invitation_status", "accepted");

  const trips = (memberRows ?? [])
    .map((row) => {
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
      return trip as {
        id: string;
        name: string | null;
        destination_name: string | null;
      } | null;
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string | null;
    destination_name: string | null;
  }>;

  return (
    <SavedPlacesWorkspace
      lists={lists}
      sharedLists={sharedLists}
      friends={friends}
      trips={trips}
    />
  );
}
