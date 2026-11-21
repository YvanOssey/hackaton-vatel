import { NextResponse, type NextRequest } from "next/server";
import { GROUPS, METHODS, TX_TYPES } from "@/lib/constants";
import { getCurrentUser } from "@/server/auth";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { ledger } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Neutralise les formules tableur (=, +, -, @) dans les champs texte */
const text = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const { t, tag, note } = await getI18n();
  if (!user || user.role !== "ADMIN" || user.mustChangePassword) return new NextResponse(t("Accès refusé"), { status: 403 });
  const from = req.nextUrl.searchParams.get("du") ?? "";
  const to = req.nextUrl.searchParams.get("au") ?? "";
  try {
    const rows = await ledger(user, from, to);
    const fmt = new Intl.DateTimeFormat(tag, { timeZone: env.timezone, dateStyle: "short", timeStyle: "short" });
    const lines = [
      ["Date", "Usager", "E-mail", "Matricule", "Catégorie", "Type", "Mode", "Opérateur", "Libellé", "Commentaire", "Montant (FCFA)", "Solde après (FCFA)"].map((h) => text(t(h))).join(";"),
      ...rows.map((r) =>
        [
          text(fmt.format(r.createdAt)),
          text(`${r.user.firstName} ${r.user.lastName}`),
          text(r.user.email),
          text(r.user.memberRef ?? ""),
          text(t(GROUPS[r.user.tariffGroup].label)),
          text(t(TX_TYPES[r.type])),
          text(t(METHODS[r.method])),
          text(r.operator ? `${r.operator.firstName} ${r.operator.lastName}` : ""),
          text(t(r.label)),
          text(r.note ? note(r.note) : ""),
          String(r.amount),
          String(r.balanceAfter),
        ].join(";"),
      ),
    ];
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cantine-grand-livre-${from}-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new NextResponse(t(e.message, e.params), { status: 400 });
    throw e;
  }
}
