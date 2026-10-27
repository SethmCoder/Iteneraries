export type TripRole = "owner" | "editor" | "viewer";
export type InvitationStatus = "pending" | "accepted" | "declined" | "removed";
export type FriendStatus = "pending" | "accepted" | "rejected" | "blocked";
export type ItineraryItemType =
  | "place"
  | "flight"
  | "hotel"
  | "train"
  | "ground_transport"
  | "other";
export type TripStatus = "planned" | "active" | "completed" | "cancelled";
export type SuggestionStatus = "pending" | "accepted" | "dismissed";
export type ImportStatus =
  | "received"
  | "processing"
  | "ready_for_review"
  | "confirmed"
  | "rejected"
  | "error";
export type TransportMode = "car" | "walking" | "bicycle" | "transit";
export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "trip_invitation"
  | "trip_invitation_accepted"
  | "itinerary_item_added"
  | "itinerary_item_edited"
  | "trip_details_changed"
  | "import_ready"
  | "import_error";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Trip = {
  id: string;
  owner_id: string;
  name: string | null;
  destination_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_image_url: string | null;
  destination_image_attribution: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripRole;
  invited_by: string | null;
  invitation_status: InvitationStatus;
  created_at: string;
};

export type ItineraryItem = {
  id: string;
  trip_id: string;
  created_by: string;
  item_type: ItineraryItemType;
  title: string;
  description: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string | null;
  sort_order: number;
  booking_reference: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  details: Record<string, unknown>;
  osm_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Friend = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  message: string;
  related_trip_id: string | null;
  related_item_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type UserPreferences = {
  user_id: string;
  preferred_transport_modes: TransportMode[];
  travel_pace: "relaxed" | "moderate" | "packed";
  interests: string[];
  distance_unit: "km" | "mi";
  timezone_display: "destination" | "home" | "utc";
  auto_confirm_imports: boolean;
  created_at: string;
  updated_at: string;
};

export type TripWithMembers = Trip & {
  trip_members?: (TripMember & { profiles?: Profile | null })[];
  members?: Profile[];
};

export type TransportSegment = {
  id: string;
  trip_id: string;
  from_item_id: string;
  to_item_id: string;
  mode: TransportMode;
  duration_seconds: number | null;
  distance_meters: number | null;
  geometry: unknown | null;
  is_manual: boolean;
  manual_duration_minutes: number | null;
  unavailable_reason: string | null;
  created_at: string;
  updated_at: string;
};
