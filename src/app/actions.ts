"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addListingRecord, isCity, isDay, isListingType } from "@/lib/listings";
import type { DayOfWeek } from "@/lib/types";

export type FormState = {
  error: string;
} | null;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
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
  if (sourceUrl && !isHttpUrl(sourceUrl)) {
    return {
      error: "Please enter a valid http or https link, or leave Source URL blank.",
    };
  }

  try {
    await addListingRecord({
      placeName,
      city,
      type,
      days: days as DayOfWeek[],
      startTime,
      endTime,
      description,
      sourceUrl: sourceUrl || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not submit listing.";
    return { error: message };
  }

  revalidatePath("/");
  redirect("/?submitted=1");
}
