export type ActivityTypeGroup =
  | "transport"
  | "stay"
  | "things_to_do"
  | "other";

export type ActivityTypeId =
  // Transport
  | "flight"
  | "train"
  | "subway"
  | "bus"
  | "car"
  | "taxi_rideshare"
  | "ferry"
  | "cruise"
  | "bike_scooter"
  | "walking"
  | "helicopter"
  // Stay
  | "hotel"
  | "resort"
  | "vacation_rental"
  | "hostel"
  | "bnb"
  | "cabin"
  | "camping"
  // Things to do
  | "sightseeing"
  | "museum"
  | "historical_site"
  | "tour"
  | "hiking"
  | "beach_water"
  | "winter_sports"
  | "park_wildlife"
  | "concert_show"
  | "sports_event"
  | "festival"
  | "theme_park"
  | "zoo_aquarium"
  | "nightlife"
  | "dining"
  | "food_market"
  | "shopping"
  | "cooking_class"
  // General
  | "meeting"
  | "other"
  // Legacy aliases kept for older saved drafts / pending rows
  | "restaurant"
  | "attraction"
  | "transportation";

export type ActivityTypeOption = {
  id: ActivityTypeId;
  label: string;
  emoji: string;
  group: ActivityTypeGroup;
  /** itinerary_items.item_type */
  itemType: "place" | "flight" | "hotel" | "train" | "ground_transport" | "other";
  category?: string;
  /** Hide from picker but still resolve for legacy ids */
  hidden?: boolean;
};

export const ACTIVITY_TYPE_GROUPS: {
  id: ActivityTypeGroup;
  label: string;
}[] = [
  { id: "transport", label: "Transportation" },
  { id: "stay", label: "Stay" },
  { id: "things_to_do", label: "Things to do" },
  { id: "other", label: "Other" },
];

export const ACTIVITY_TYPES: ActivityTypeOption[] = [
  // Transportation
  {
    id: "flight",
    label: "Flight",
    emoji: "✈️",
    group: "transport",
    itemType: "flight",
    category: "flight",
  },
  {
    id: "train",
    label: "Train",
    emoji: "🚆",
    group: "transport",
    itemType: "train",
    category: "transport",
  },
  {
    id: "subway",
    label: "Subway / Metro",
    emoji: "🚇",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "bus",
    label: "Bus",
    emoji: "🚌",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "car",
    label: "Car / Road trip",
    emoji: "🚗",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "taxi_rideshare",
    label: "Taxi / Rideshare",
    emoji: "🚕",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "ferry",
    label: "Ferry",
    emoji: "⛴️",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "cruise",
    label: "Cruise",
    emoji: "🛳️",
    group: "transport",
    itemType: "other",
    category: "transport",
  },
  {
    id: "bike_scooter",
    label: "Bike / Scooter",
    emoji: "🚲",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "walking",
    label: "Walking",
    emoji: "🚶",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },
  {
    id: "helicopter",
    label: "Helicopter",
    emoji: "🚁",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
  },

  // Stay
  {
    id: "hotel",
    label: "Hotel / Motel",
    emoji: "🏨",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "resort",
    label: "Resort",
    emoji: "🏝️",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "vacation_rental",
    label: "Vacation rental",
    emoji: "🏠",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "hostel",
    label: "Hostel",
    emoji: "🛏️",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "bnb",
    label: "B&B / Guesthouse",
    emoji: "🏡",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "cabin",
    label: "Cabin / Cottage",
    emoji: "🪵",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },
  {
    id: "camping",
    label: "Camping / RV",
    emoji: "⛺",
    group: "stay",
    itemType: "hotel",
    category: "hotel",
  },

  // Things to do
  {
    id: "sightseeing",
    label: "Sightseeing / Landmarks",
    emoji: "📍",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "museum",
    label: "Museum / Gallery",
    emoji: "🏛️",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "historical_site",
    label: "Historical site",
    emoji: "🏺",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "tour",
    label: "Tour",
    emoji: "🧭",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "hiking",
    label: "Hiking",
    emoji: "🥾",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "beach_water",
    label: "Beach / Water sports",
    emoji: "🏖️",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "winter_sports",
    label: "Skiing / Winter sports",
    emoji: "⛷️",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "park_wildlife",
    label: "Parks / Wildlife",
    emoji: "🏞️",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "concert_show",
    label: "Concert / Theater",
    emoji: "🎭",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "sports_event",
    label: "Sporting event",
    emoji: "🏟️",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "festival",
    label: "Festival",
    emoji: "🎉",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "theme_park",
    label: "Theme park",
    emoji: "🎢",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "zoo_aquarium",
    label: "Zoo / Aquarium",
    emoji: "🐠",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "nightlife",
    label: "Nightlife",
    emoji: "🌙",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "dining",
    label: "Dining",
    emoji: "🍽️",
    group: "things_to_do",
    itemType: "place",
    category: "restaurants",
  },
  {
    id: "food_market",
    label: "Food market",
    emoji: "🛒",
    group: "things_to_do",
    itemType: "place",
    category: "restaurants",
  },
  {
    id: "shopping",
    label: "Shopping",
    emoji: "🛍️",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },
  {
    id: "cooking_class",
    label: "Cooking class",
    emoji: "👨‍🍳",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
  },

  // Other
  {
    id: "meeting",
    label: "Meeting",
    emoji: "📅",
    group: "other",
    itemType: "other",
    category: "meeting",
  },
  {
    id: "other",
    label: "Other",
    emoji: "📌",
    group: "other",
    itemType: "other",
    category: "other",
  },

  // Legacy (hidden) — still resolve for existing data
  {
    id: "restaurant",
    label: "Dining",
    emoji: "🍽️",
    group: "things_to_do",
    itemType: "place",
    category: "restaurants",
    hidden: true,
  },
  {
    id: "attraction",
    label: "Sightseeing / Landmarks",
    emoji: "📍",
    group: "things_to_do",
    itemType: "place",
    category: "attractions",
    hidden: true,
  },
  {
    id: "transportation",
    label: "Car / Road trip",
    emoji: "🚗",
    group: "transport",
    itemType: "ground_transport",
    category: "transport",
    hidden: true,
  },
];

const byId = new Map(ACTIVITY_TYPES.map((t) => [t.id, t]));

export function getActivityType(id: ActivityTypeId | string): ActivityTypeOption {
  return byId.get(id as ActivityTypeId) ?? byId.get("other")!;
}

export function visibleActivityTypes(): ActivityTypeOption[] {
  return ACTIVITY_TYPES.filter((t) => !t.hidden);
}

export function activityTypesByGroup(): {
  group: (typeof ACTIVITY_TYPE_GROUPS)[number];
  options: ActivityTypeOption[];
}[] {
  const visible = visibleActivityTypes();
  return ACTIVITY_TYPE_GROUPS.map((group) => ({
    group,
    options: visible.filter((t) => t.group === group.id),
  })).filter((g) => g.options.length > 0);
}
