"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, RefreshCw, SwitchCamera } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { looksLikePass } from "@/lib/pass-scan";
import { useI18n } from "@/i18n/client";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Problem = "denied" | "nocamera" | "insecure" | "other";

const PROBLEMS: Record<Problem, string> = {
  denied: "Accès à la caméra refusé. Autorisez la caméra pour ce site dans le navigateur, puis réessayez.",
  nocamera: "Aucune caméra détectée sur cet appareil. Utilisez la douchette ou la recherche par nom.",
  insecure: "La caméra n'est disponible que sur une adresse sécurisée (https).",
  other: "La caméra n'a pas pu démarrer. Fermez les autres applications qui l'utilisent, puis réessayez.",
};

/** Lecteur intégré du navigateur (Chrome, Edge, Android) quand il sait lire les QR Codes */
async function nativeDetector(): Promise<Detector | null> {
  const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const formats = (await BD.getSupportedFormats?.()) ?? [];
    return formats.includes("qr_code") ? new BD({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/**
 * Lecteur de pass par caméra (caisse). Lit en continu jusqu'à trouver un pass CantineConnect,
 * puis s'arrête et le transmet ; la fiche de l'étudiant s'ouvre pour valider le repas.
 */
export function CameraScanner({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (text: string) => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const result = useRef(onResult);
  result.current = onResult;

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    setProblem(null);
    setHint(null);
    setReady(false);

    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setProblem("insecure");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: cameraId ? { deviceId: { exact: cameraId } } : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e) {
        const name = (e as DOMException)?.name;
        return setProblem(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "other");
      }
      if (stopped || !video.current) return stop();
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setReady(true);
      navigator.mediaDevices
        .enumerateDevices()
        .then((d) => setCameras(d.filter((x) => x.kind === "videoinput")))
        .catch(() => {});

      const native = await nativeDetector();
      const jsQR = native ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped) return;
        const v = video.current;
        let text: string | null = null;
        if (v && v.readyState >= 2 && v.videoWidth) {
          try {
            if (native) {
              text = (await native.detect(v))[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              // Image réduite : lecture plus rapide, suffisante pour un QR présenté à 10-30 cm
              const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
              canvas.width = Math.round(v.videoWidth * scale);
              canvas.height = Math.round(v.videoHeight * scale);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          } catch {
            /* image illisible : on réessaie à la prochaine */
          }
        }
        if (stopped) return;
        if (text && looksLikePass(text)) {
          navigator.vibrate?.(60);
          stop();
          result.current(text);
          return;
        }
        if (text) setHint("Ce QR Code n'est pas un pass CantineConnect.");
        timer = window.setTimeout(tick, 120);
      };
      tick();
    })();

    return stop;
  }, [open, cameraId, attempt]);

  const nextCamera = () => {
    if (cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.deviceId === cameraId);
    setCameraId(cameras[(i + 1) % cameras.length].deviceId);
  };

  return (
    <Modal open={open} onClose={onClose} title={t("Scanner un pass")}>
      <div className="space-y-4 p-5">
        {/* La vidéo reste toujours dans la page : après une erreur, « Réessayer » la retrouve prête à recevoir le flux */}
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-950">
          <video ref={video} muted playsInline aria-label={t("Image de la caméra")} className="size-full object-cover" />
          {!problem && (
            <>
              {/* Viseur : coins et ligne de balayage (transform uniquement) */}
              <div className="pointer-events-none absolute inset-[14%]" aria-hidden>
                {["left-0 top-0 border-l-4 border-t-4 rounded-tl-xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
                  <span key={c} className={`absolute size-10 border-brand-300 ${c}`} />
                ))}
                {ready && (
                  <span className="anim-scan absolute inset-x-2 top-0 h-full">
                    <span className="block h-0.5 rounded-full bg-brand-300 shadow-[0_0_12px_2px_rgba(134,195,234,0.8)]" />
                  </span>
                )}
              </div>
              {!ready && <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/80">{t("Ouverture de la caméra…")}</p>}
            </>
          )}
          {problem && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center" role="alert">
              <CameraOff className="size-8 text-slate-400" />
              <p className="text-sm text-slate-700">{t(PROBLEMS[problem])}</p>
              {problem !== "insecure" && (
                <Button variant="secondary" onClick={() => setAttempt((x) => x + 1)}>
                  <RefreshCw className="size-4" /> {t("Réessayer")}
                </Button>
              )}
            </div>
          )}
        </div>
        {!problem && (
          <p className="text-center text-sm text-slate-600" aria-live="polite">
            {hint ? <span className="font-medium text-amber-700">{t(hint)}</span> : t("Placez le QR Code du pass de l'étudiant dans le cadre.")}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {cameras.length > 1 && !problem && (
            <Button variant="secondary" onClick={nextCamera}>
              <SwitchCamera className="size-4" /> {t("Changer de caméra")}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t("Fermer")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
