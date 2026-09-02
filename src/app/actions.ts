"use server";

import { revalidatePath } from "next/cache";

export async function revalidatePublicListings() {
  revalidatePath("/");
  revalidatePath("/listings", "layout");
}
