import { headers } from "next/headers";
import { isRegion, REGION_HEADER, type Region } from "@/lib/region";

export async function getRequestRegion(): Promise<Region> {
  const headerStore = await headers();
  const value = headerStore.get(REGION_HEADER);
  return isRegion(value) ? value : "757";
}
