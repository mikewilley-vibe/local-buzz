export const REGIONS = ["757", "rva"] as const;

export type Region = (typeof REGIONS)[number];

export type RegionFilter = "all" | Region;

export const REGION_COOKIE = "lb_region";
export const REGION_HEADER = "x-lb-region";

export function isRegion(value: string | null | undefined): value is Region {
  return value === "757" || value === "rva";
}

export function regionLabel(region: Region) {
  return region === "rva" ? "RVA" : "757";
}

export function regionPlaceName(region: Region) {
  return region === "rva" ? "Richmond" : "Hampton Roads";
}
