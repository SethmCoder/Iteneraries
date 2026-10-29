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
  | "import_error"
  | "flight_match_found"
  | "flight_search_error"
  | "account_renewal_reminder"
  | "account_renewed"
  | "account_expired";

export type AccountPlan = "free" | "pro";
export type AccountBillingStatus = "active" | "expired" | "canceled" | "past_due";
export type BillingProvider = "none" | "manual" | "stripe";
export type AccountReminderStage = "none" | "d7" | "d1" | "expired";

export type AccountBilling = {
  user_id: string;
  plan: AccountPlan;
  status: AccountBillingStatus;
  billing_provider: BillingProvider;
  current_period_start: string;
  current_period_end: string;
  delete_after: string | null;
  last_renewed_at: string | null;
  reminder_stage: AccountReminderStage;
  last_reminder_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AwardCabin = "economy" | "premium_economy" | "business" | "first";
export type AwardTripType = "one_way" | "round_trip";
export type AwardSearchStatus =
  | "monitoring"
  | "match_found"
  | "paused"
  | "setup_required";
export type AwardAvailabilityStatus =
  | "confirmed"
  | "estimated"
  | "stale"
  | "unverified";
export type LoyaltyBalanceSource = "manual" | "verified";

export type AwardSearchPreferences = {
  departTimeStart?: string | null;
  departTimeEnd?: string | null;
  arriveTimeStart?: string | null;
  arriveTimeEnd?: string | null;
  maxConnections?: number | null;
  preferredAirlines?: string[];
  preferredAlliances?: string[];
  maxLayoverMinutes?: number | null;
  nearbyAirportsOk?: boolean;
  mixedCabinOk?: boolean;
  separateTicketsOk?: boolean;
};

export type LoyaltyBalance = {
  id: string;
  user_id: string;
  program: string;
  balance: number;
  currency_label: string;
  source: LoyaltyBalanceSource;
  last_verified_at: string | null;
  external_account_id: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
};

export type LoyaltyConnection = {
  id: string;
  user_id: string;
  provider: "awardwallet" | "awardwallet_parse";
  external_user_id: string;
  access_level: string;
  status: "connected" | "disconnected" | "error";
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AwardSearch = {
  id: string;
  user_id: string;
  trip_id: string | null;
  origin: string;
  destination: string;
  trip_type: AwardTripType;
  depart_date: string | null;
  depart_date_end: string | null;
  return_date: string | null;
  return_date_end: string | null;
  passengers: number;
  cabin: AwardCabin;
  max_points_per_passenger: number | null;
  max_points_total: number | null;
  max_cash_fees: number | null;
  preferred_program: string | null;
  status: AwardSearchStatus;
  notify_on_match: boolean;
  require_booking_approval: boolean;
  poll_interval_minutes: number;
  last_checked_at: string | null;
  last_notified_fingerprint: string | null;
  paused_at: string | null;
  preferences: AwardSearchPreferences;
  created_at: string;
  updated_at: string;
};

export type AwardResult = {
  id: string;
  search_id: string;
  airline: string | null;
  flight_numbers: string | null;
  origin_airport: string;
  destination_airport: string;
  depart_at: string | null;
  arrive_at: string | null;
  timezone: string | null;
  duration_minutes: number | null;
  stops: number;
  cabin: string | null;
  points_per_passenger: number | null;
  points_total: number | null;
  taxes_fees: number | null;
  currency: string | null;
  loyalty_program: string | null;
  booking_url: string | null;
  availability_status: AwardAvailabilityStatus;
  provider: string;
  provider_result_id: string | null;
  fingerprint: string;
  compromises: string[];
  raw: Record<string, unknown>;
  checked_at: string;
  user_approved_at: string | null;
  created_at: string;
};

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
  email_slug: string | null;
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
  award_check_enabled: boolean;
  award_check_timezone: string;
  award_check_start_minute: number;
  award_check_end_minute: number;
  award_approve_to_book: boolean;
  created_at: string;
  updated_at: string;
};

export type BookingStatus =
  | "needs_booking"
  | "in_progress"
  | "booked"
  | "skipped";

export type PendingFlight = {
  id: string;
  user_id: string;
  trip_id: string;
  origin: string;
  destination: string;
  depart_date: string | null;
  return_date: string | null;
  passengers: number;
  airline: string | null;
  flight_number?: string | null;
  booking_status: BookingStatus;
  booking_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingHotel = {
  id: string;
  user_id: string;
  trip_id: string;
  hotel_name: string;
  location: string | null;
  check_in: string | null;
  check_out: string | null;
  rooms: number;
  guests: number;
  booking_status: BookingStatus;
  booking_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingCar = {
  id: string;
  user_id: string;
  trip_id: string;
  provider: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_at: string | null;
  dropoff_at: string | null;
  booking_status: BookingStatus;
  booking_url: string | null;
  confirmation_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingActivity = {
  id: string;
  user_id: string;
  trip_id: string;
  title: string;
  activity_type: string;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  booking_status: BookingStatus;
  booking_url: string | null;
  confirmation_number: string | null;
  notes: string | null;
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
