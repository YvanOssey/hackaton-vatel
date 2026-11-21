import "server-only";
import { bookingState, mealPrice } from "@/lib/rules";
import { isIsoDate, isoToDate } from "@/lib/utils";
import { prisma } from "../db";
import { AppError } from "../errors";
import { clock } from "../time";
import { type Actor, assertRole, committedAmount, getSettings, lockUser } from "./common";

export async function reserveMeal(actor: Actor, date: string) {
  assertRole(actor, ["CONSUMER"]);
  if (actor.status !== "ACTIVE") throw new AppError("Votre compte doit être validé par l'administration avant de pouvoir réserver.", "PENDING");
  if (!isIsoDate(date)) throw new AppError("Date invalide.");

  return prisma.$transaction(async (tx) => {
    const user = await lockUser(tx, actor.id);
    const settings = await getSettings(tx);
    const now = clock();
    const state = bookingState(date, now, settings.cutoffTime, settings.bookingHorizonDays);
    if (!state.open) throw new AppError(state.reason, "CLOSED", state.params);

    const menu = await tx.menu.findUnique({ where: { date: isoToDate(date) } });
    if (!menu || menu.status !== "PUBLISHED") throw new AppError("Aucun menu publié pour ce jour.", "NO_MENU");

    const existing = await tx.reservation.findUnique({ where: { userId_date: { userId: user.id, date: isoToDate(date) } } });
    if (existing?.status === "RESERVED") throw new AppError("Vous avez déjà réservé ce repas.", "DUPLICATE");
    if (existing?.status === "SERVED") throw new AppError("Ce repas vous a déjà été servi.", "DUPLICATE");

    const price = mealPrice(settings);
    const available = user.balance - (await committedAmount(tx, user.id, now.today));
    if (available < price) {
      throw new AppError("Solde disponible insuffisant ({amount:money}). Rechargez votre portefeuille.", "INSUFFICIENT", { amount: available });
    }

    const reservation = existing
      ? await tx.reservation.update({
          where: { id: existing.id },
          data: { status: "RESERVED", price, cancelledAt: null, walkIn: false },
        })
      : await tx.reservation.create({ data: { userId: user.id, date: isoToDate(date), price } });
    return { reservation, date, price };
  });
}

export async function cancelReservation(actor: Actor, reservationId: string) {
  assertRole(actor, ["CONSUMER"]);
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    // La réservation doit appartenir à l'usager connecté
    const res = await tx.reservation.findFirst({ where: { id: reservationId, userId: actor.id } });
    if (!res || res.status !== "RESERVED") throw new AppError("Réservation introuvable ou déjà traitée.", "NOT_FOUND");
    const settings = await getSettings(tx);
    const state = bookingState(res.date.toISOString().slice(0, 10), clock(), settings.cutoffTime, 3650);
    if (!state.open) throw new AppError(state.reason, "CLOSED", state.params);
    await tx.reservation.update({ where: { id: res.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    return { released: res.price };
  });
}
