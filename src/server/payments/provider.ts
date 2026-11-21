import "server-only";
import type { MobileProvider } from "@prisma/client";

/**
 * Passerelle Mobile Money. L'application ne crédite un portefeuille qu'après la confirmation
 * de l'opérateur (statut SUCCEEDED), une seule fois par paiement.
 *
 * Le mode « sandbox » (par défaut) simule l'opérateur : aucun argent réel ne circule.
 * Pour brancher Wave ou Orange Money, implémentez `PaymentGateway` avec leur API
 * (création de la demande, puis vérification ou webhook) et sélectionnez-la via PAYMENT_MODE.
 */
export interface PaymentGateway {
  mode: "sandbox" | "live";
  /** Envoie la demande de paiement sur le téléphone du payeur */
  initiate(p: { reference: string; provider: MobileProvider; phone: string; amount: number }): Promise<void>;
  /** Interroge l'opérateur sur l'état de la demande */
  check(p: { reference: string; phone: string }): Promise<{ status: "SUCCEEDED" } | { status: "PENDING" } | { status: "FAILED"; reason: string }>;
}

/** Simulateur : un numéro finissant par 0000 refuse le paiement (pour tester l'échec) */
const sandbox: PaymentGateway = {
  mode: "sandbox",
  async initiate() {},
  async check({ phone }) {
    if (phone.endsWith("0000")) return { status: "FAILED", reason: "Paiement refusé par l'opérateur (solde Mobile Money insuffisant)." };
    return { status: "SUCCEEDED" };
  },
};

export function paymentGateway(): PaymentGateway {
  return sandbox;
}
