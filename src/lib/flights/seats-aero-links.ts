/** Free public seats.aero search URL (no API key). Opens their website. */
export function seatsAeroSearchUrl(input: {
  origin: string;
  destination: string;
  departDate?: string | null;
}): string {
  const params = new URLSearchParams({
    origin: input.origin.trim().toUpperCase(),
    destination: input.destination.trim().toUpperCase(),
  });
  if (input.departDate) params.set("departureDate", input.departDate);
  return `https://seats.aero/?${params.toString()}`;
}
