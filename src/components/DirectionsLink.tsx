import { listingDirectionsUrl, type ListingLocation } from "@/lib/location";

export function DirectionsLink({
  location,
}: {
  location: ListingLocation;
}) {
  const href = listingDirectionsUrl(location);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--amber-deep)] underline outline-none ring-[var(--amber)] focus-visible:ring-2"
    >
      Get directions
    </a>
  );
}
