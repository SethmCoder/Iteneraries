export type AirportOption = {
  code: string;
  city: string;
  name: string;
  country: string;
};

/** Compact IATA dataset for autocomplete (major business-travel hubs). */
export const AIRPORTS: AirportOption[] = [
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson", country: "US" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International", country: "US" },
  { code: "ORD", city: "Chicago", name: "O'Hare", country: "US" },
  { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth", country: "US" },
  { code: "DEN", city: "Denver", name: "Denver International", country: "US" },
  { code: "JFK", city: "New York", name: "John F. Kennedy", country: "US" },
  { code: "SFO", city: "San Francisco", name: "San Francisco International", country: "US" },
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma", country: "US" },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid", country: "US" },
  { code: "MCO", city: "Orlando", name: "Orlando International", country: "US" },
  { code: "EWR", city: "Newark", name: "Newark Liberty", country: "US" },
  { code: "MIA", city: "Miami", name: "Miami International", country: "US" },
  { code: "CLT", city: "Charlotte", name: "Charlotte Douglas", country: "US" },
  { code: "PHX", city: "Phoenix", name: "Sky Harbor", country: "US" },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental", country: "US" },
  { code: "BOS", city: "Boston", name: "Logan", country: "US" },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis–Saint Paul", country: "US" },
  { code: "DTW", city: "Detroit", name: "Detroit Metropolitan", country: "US" },
  { code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale–Hollywood", country: "US" },
  { code: "LGA", city: "New York", name: "LaGuardia", country: "US" },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia International", country: "US" },
  { code: "BWI", city: "Baltimore", name: "Baltimore/Washington", country: "US" },
  { code: "DCA", city: "Washington", name: "Ronald Reagan National", country: "US" },
  { code: "IAD", city: "Washington", name: "Dulles", country: "US" },
  { code: "SAN", city: "San Diego", name: "San Diego International", country: "US" },
  { code: "TPA", city: "Tampa", name: "Tampa International", country: "US" },
  { code: "PDX", city: "Portland", name: "Portland International", country: "US" },
  { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye", country: "US" },
  { code: "SLC", city: "Salt Lake City", name: "Salt Lake City International", country: "US" },
  { code: "AUS", city: "Austin", name: "Austin-Bergstrom", country: "US" },
  { code: "BNA", city: "Nashville", name: "Nashville International", country: "US" },
  { code: "RDU", city: "Raleigh", name: "Raleigh–Durham", country: "US" },
  { code: "YUL", city: "Montreal", name: "Montréal–Trudeau", country: "CA" },
  { code: "YYZ", city: "Toronto", name: "Toronto Pearson", country: "CA" },
  { code: "YVR", city: "Vancouver", name: "Vancouver International", country: "CA" },
  { code: "LHR", city: "London", name: "Heathrow", country: "GB" },
  { code: "LGW", city: "London", name: "Gatwick", country: "GB" },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "FR" },
  { code: "ORY", city: "Paris", name: "Orly", country: "FR" },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "DE" },
  { code: "MUC", city: "Munich", name: "Munich Airport", country: "DE" },
  { code: "AMS", city: "Amsterdam", name: "Schiphol", country: "NL" },
  { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid–Barajas", country: "ES" },
  { code: "BCN", city: "Barcelona", name: "El Prat", country: "ES" },
  { code: "FCO", city: "Rome", name: "Fiumicino", country: "IT" },
  { code: "MXP", city: "Milan", name: "Malpensa", country: "IT" },
  { code: "ZRH", city: "Zurich", name: "Zurich Airport", country: "CH" },
  { code: "GVA", city: "Geneva", name: "Geneva", country: "CH" },
  { code: "VIE", city: "Vienna", name: "Vienna International", country: "AT" },
  { code: "CPH", city: "Copenhagen", name: "Copenhagen", country: "DK" },
  { code: "ARN", city: "Stockholm", name: "Arlanda", country: "SE" },
  { code: "OSL", city: "Oslo", name: "Oslo Gardermoen", country: "NO" },
  { code: "HEL", city: "Helsinki", name: "Helsinki-Vantaa", country: "FI" },
  { code: "DUB", city: "Dublin", name: "Dublin Airport", country: "IE" },
  { code: "LIS", city: "Lisbon", name: "Humberto Delgado", country: "PT" },
  { code: "IST", city: "Istanbul", name: "Istanbul Airport", country: "TR" },
  { code: "DXB", city: "Dubai", name: "Dubai International", country: "AE" },
  { code: "AUH", city: "Abu Dhabi", name: "Abu Dhabi International", country: "AE" },
  { code: "DOH", city: "Doha", name: "Hamad International", country: "QA" },
  { code: "SIN", city: "Singapore", name: "Changi", country: "SG" },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong International", country: "HK" },
  { code: "NRT", city: "Tokyo", name: "Narita", country: "JP" },
  { code: "HND", city: "Tokyo", name: "Haneda", country: "JP" },
  { code: "ICN", city: "Seoul", name: "Incheon", country: "KR" },
  { code: "PEK", city: "Beijing", name: "Capital", country: "CN" },
  { code: "PVG", city: "Shanghai", name: "Pudong", country: "CN" },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi", country: "TH" },
  { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International", country: "MY" },
  { code: "SYD", city: "Sydney", name: "Kingsford Smith", country: "AU" },
  { code: "MEL", city: "Melbourne", name: "Tullamarine", country: "AU" },
  { code: "AKL", city: "Auckland", name: "Auckland", country: "NZ" },
  { code: "GRU", city: "São Paulo", name: "Guarulhos", country: "BR" },
  { code: "GIG", city: "Rio de Janeiro", name: "Galeão", country: "BR" },
  { code: "EZE", city: "Buenos Aires", name: "Ezeiza", country: "AR" },
  { code: "MEX", city: "Mexico City", name: "Benito Juárez", country: "MX" },
  { code: "CUN", city: "Cancún", name: "Cancún International", country: "MX" },
  { code: "BOG", city: "Bogotá", name: "El Dorado", country: "CO" },
  { code: "LIM", city: "Lima", name: "Jorge Chávez", country: "PE" },
  { code: "SCL", city: "Santiago", name: "Arturo Merino Benítez", country: "CL" },
  { code: "JNB", city: "Johannesburg", name: "O. R. Tambo", country: "ZA" },
  { code: "CPT", city: "Cape Town", name: "Cape Town International", country: "ZA" },
  { code: "CAI", city: "Cairo", name: "Cairo International", country: "EG" },
  { code: "NBO", city: "Nairobi", name: "Jomo Kenyatta", country: "KE" },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi", country: "IN" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji", country: "IN" },
];

export function searchAirports(query: string, limit = 8): AirportOption[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return AIRPORTS.slice(0, limit);
  const scored = AIRPORTS.map((a) => {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 80;
    else if (city.startsWith(q)) score = 60;
    else if (city.includes(q) || name.includes(q) || code.includes(q)) score = 40;
    return { a, score };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.code.localeCompare(y.a.code));
  return scored.slice(0, limit).map((x) => x.a);
}

export const LOYALTY_PROGRAMS = [
  { id: "united", label: "United MileagePlus" },
  { id: "american", label: "American AAdvantage" },
  { id: "delta", label: "Delta SkyMiles" },
  { id: "aeroplan", label: "Air Canada Aeroplan" },
  { id: "alaska", label: "Alaska Mileage Plan" },
  { id: "flyingblue", label: "Flying Blue" },
  { id: "britishairways", label: "British Airways Avios" },
  { id: "lufthansa", label: "Miles & More" },
  { id: "singapore", label: "KrisFlyer" },
  { id: "qatar", label: "Privilege Club" },
  { id: "emirates", label: "Skywards" },
  { id: "jetblue", label: "TrueBlue" },
  { id: "virginatlantic", label: "Virgin Atlantic Flying Club" },
  { id: "qantas", label: "Qantas Frequent Flyer" },
] as const;
