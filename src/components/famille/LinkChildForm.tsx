"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { linkChildAction } from "@/app/famille/actions";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

/** Saisie du code d'association : formatage automatique XXXX-XXXX */
export function LinkChildForm({ className }: { className?: string }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const raw = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (raw.length !== 8) {
          document.getElementById("link-code")?.focus();
          return setError(t("Le code comporte 8 caractères (ex. K7PM-4QX9)."));
        }
        start(async () => {
          const res = await linkChildAction(raw);
          if (!res.ok) return setError(res.message);
          setError(null);
          setCode("");
          toast({ tone: "success", title: t("Enfant associé"), description: res.message });
          router.push("/famille");
        });
      }}
    >
      <label htmlFor="link-code" className="block text-sm font-medium text-slate-700">
        {t("Code d'association")}
      </label>
      <div className={cn("flex h-14 items-center rounded-2xl bg-white ring-1 ring-inset transition", error ? "ring-red-300" : "ring-slate-200 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]")}>
        <KeyRound className="ml-4 size-5 text-slate-400" />
        <input
          id="link-code"
          value={raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}` : raw}
          onChange={(e) => {
            setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8));
            setError(null);
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="K7PM-4QX9…"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "link-code-error" : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-xl font-semibold uppercase tracking-[0.2em] text-slate-900 outline-none placeholder:font-normal placeholder:tracking-[0.2em] placeholder:text-slate-300"
        />
      </div>
      {error && (
        <p id="link-code-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <LoaderCircle className="size-5 animate-spin" />} {t("Associer")}
      </Button>
    </form>
  );
}
