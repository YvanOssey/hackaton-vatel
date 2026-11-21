"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/actor";
import { msg, run } from "@/server/errors";
import { linkChild, unlink } from "@/server/services/family";

export async function linkChildAction(code: string) {
  return run(
    async () => {
      const child = await linkChild(await currentActor(), code);
      revalidatePath("/famille", "layout");
      return child;
    },
    (c) => msg("Vous suivez désormais {name}.", { name: c.firstName }),
  );
}

export async function unlinkChildAction(childId: string) {
  return run(async () => {
    await unlink(await currentActor(), childId);
    revalidatePath("/famille", "layout");
  }, "Association supprimée.");
}
