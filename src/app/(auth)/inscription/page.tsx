import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Inscription") };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
