"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addListingRecord } from "@/lib/listings";
import { parseListingFormData } from "@/lib/listing-form";

export type FormState = {
  error: string;
} | null;

export async function addListing(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseListingFormData(formData);
  if ("error" in parsed) return parsed;

  try {
    await addListingRecord(parsed.listing);
  } catch {
    return { error: "Could not submit listing." };
  }

  revalidatePath("/");
  redirect("/?submitted=1");
}
