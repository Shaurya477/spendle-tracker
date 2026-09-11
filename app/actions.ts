"use server";

import { updateTag } from "next/cache";
import { TRACKER_TAG } from "@/lib/pendle/tracker";

/** Drop the cached dashboard dataset so the next render reads the chain again. */
export async function refreshTracker() {
  updateTag(TRACKER_TAG);
}
