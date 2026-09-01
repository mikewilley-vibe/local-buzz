"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addListingRecord, isCity, isDay, isListingType } from "@/lib/listings";
import type { DayOfWeek } from "@/lib/types";

export type FormState = {
  error: string;
} | null;

export async function addListing(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const placeName = String(formData.get("placeName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const days = formData
    .getAll("days")
    .map((value) => String(value))
    .filter(isDay);

  if (!placeName) return { error: "Please add the bar or restaurant name." };
  if (!isCity(city)) return { error: "Please pick a Hampton Roads city." };
  if (!isListingType(type)) return { error: "Please pick what kind of listing this is." };
  if (days.length === 0) return { error: "Please pick at least one day of the week." };
  if (!startTime) return { error: "Please add a start time." };
  if (!description) return { error: "Please add a short description." };

  await addListingRecord({
    id: crypto.randomUUID(),
    placeName,
    city,
    type,
    days: days as DayOfWeek[],
    startTime,
    endTime,
    description,
  });

  revalidatePath("/");
  redirect("/?added=1");
}
