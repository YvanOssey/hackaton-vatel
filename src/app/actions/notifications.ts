"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/actor";
import { run } from "@/server/errors";
import { markRead } from "@/server/services/notifications";

export async function markReadAction(ids?: string[]) {
  return run(async () => {
    await markRead(await currentActor(), ids);
    revalidatePath("/", "layout");
  });
}
