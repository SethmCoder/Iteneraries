export type ActivityTypeId =
  | "restaurant"
  | "meeting"
  | "transportation"
  | "attraction"
  | "hotel"
  | "flight"
  | "other";

export type ActivityTypeOption = {
  id: ActivityTypeId;
  label: string;
  emoji: string;
  /** itinerary_items.item_type */
  itemType: "place" | "flight" | "hotel" | "train" | "ground_transport" | "other";
  category?: string;
};

export const ACTIVITY_TYPES: ActivityTypeOption[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    emoji: "🍽️",
    itemType: "place",
    category: "restaurants",
  },
  {
    id: "meeting",
    label: "Meeting",
    emoji: "📅",
    itemType: "other",
    category: "meeting",
  },
  {
    id: "transportation",
    label: "Transportation",
    emoji: "🚗",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "attraction",
    label: "Attraction",
    emoji: "📍",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "hotel",
    label: "Hotel",
    emoji: "🏨",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "flight",
    label: "Flight",
    emoji: "✈️",
    itemType: "flight",
    category: "flight",
  },
  {
    id: "other",
    label: "Other",
    emoji: "📌",
    itemType: "other",
    category: "other",
  },
];

export function getActivityType(id: ActivityTypeId): ActivityTypeOption {
  return ACTIVITY_TYPES.find((t) => t.id === id) ?? ACTIVITY_TYPES[6]!;
}
