"use client";

/**
 * Table dressée en 3D (Three.js) : nappe blanche, assiette de porcelaine à liseré bleu, couverts en argent,
 * verre, bougie qui vacille et cloche en argent. La cloche se soulève selon `progress` (0 → 1) pour révéler le plat.
 * Tout est modélisé en code : aucun fichier 3D à charger. Le rendu s'arrête quand la scène n'est pas visible.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type Props = {
  /** Avancement du service, lu à chaque image (0 = cloche posée, 1 = plat révélé) */
  progress: React.RefObject<number>;
  /** Mobile et tablette : décalage vertical de la scène (px vers le bas), au repos et cloche levée, mesuré d'après le texte */
  framing?: React.RefObject<{ rest: number; reveal: number }>;
  /** Mouvement réduit : pas de flottement ni de vacillement, la caméra ne suit pas la souris */
  reduced: boolean;
  /** Couleur de marque (liseré de l'assiette, contre-jour) */
  brand: string;
  onReady?: () => void;
  onFail?: () => void;
  className?: string;
};

const TABLE_Y = 0.75;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Profil tourné (LatheGeometry) à partir de points [rayon, hauteur] */
const lathe = (pts: [number, number][], segments = 96) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments);

function buildScene(brand: string) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  // ─── Matières ───
  const linen = new THREE.MeshStandardMaterial({ color: 0xe9e8e4, roughness: 0.95 });
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xfbfbf8, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.14 });
  const brushed = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.32 });
  const blue = new THREE.MeshStandardMaterial({ color: new THREE.Color(brand), metalness: 0.35, roughness: 0.35 });
  const charger = new THREE.MeshStandardMaterial({ color: 0x1d1d1b, metalness: 0.2, roughness: 0.55 });

  // ─── Table et nappe tombante ───
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.03, 128), linen);
  top.position.y = TABLE_Y - 0.015;
  top.receiveShadow = true;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.155, 1.22, 0.62, 128, 1, true), linen);
  skirt.position.y = TABLE_Y - 0.31;
  skirt.material = linen.clone();
  (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  group.add(top, skirt);

  // ─── Assiette de présentation, assiette, liseré bleu ───
  const chargerPlate = new THREE.Mesh(lathe([[0, 0], [0.2, 0], [0.215, 0.008], [0.22, 0.012], [0.2, 0.012], [0, 0.006]]), charger);
  chargerPlate.position.y = TABLE_Y;
  chargerPlate.receiveShadow = true;
  const plate = new THREE.Mesh(
    lathe([[0, 0.004], [0.09, 0.004], [0.11, 0.008], [0.15, 0.022], [0.165, 0.026], [0.168, 0.024], [0.15, 0.018], [0.11, 0.004], [0.09, 0], [0, 0]]),
    porcelain,
  );
  plate.position.y = TABLE_Y + 0.012;
  plate.castShadow = plate.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.0022, 12, 128), blue);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TABLE_Y + 0.012 + 0.0255;
  group.add(chargerPlate, plate, rim);

  // ─── Le plat : riz en dôme, sauce arachide, viande, herbes ───
  const food = new THREE.Group();
  food.position.y = TABLE_Y + 0.017;
  const rice = new THREE.Mesh(new THREE.SphereGeometry(0.055, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf1e8d2, roughness: 0.95 }));
  rice.scale.set(1, 0.7, 1);
  rice.position.set(-0.035, 0, 0.01);
  const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.01, 64), new THREE.MeshPhysicalMaterial({ color: 0xa8521f, roughness: 0.28, clearcoat: 0.6 }));
  sauce.scale.set(1, 1, 0.82);
  sauce.position.set(0.045, 0.005, -0.005);
  const meatMat = new THREE.MeshStandardMaterial({ color: 0x6e3417, roughness: 0.55 });
  const meat1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.03, 6, 16), meatMat);
  meat1.rotation.set(Math.PI / 2, 0, 0.6);
  meat1.position.set(0.04, 0.016, 0.005);
  const meat2 = meat1.clone();
  meat2.rotation.z = -0.4;
  meat2.position.set(0.065, 0.016, -0.02);
  const herbMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.6, side: THREE.DoubleSide });
  const herbs = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), herbMat);
    leaf.scale.set(1, 0.5, 1);
    leaf.rotation.set(-Math.PI / 2 + 0.3 * Math.sin(i), 0, i * 1.3);
    leaf.position.set(-0.04 + Math.cos(i * 1.7) * 0.02, 0.04, 0.01 + Math.sin(i * 1.7) * 0.02);
    herbs.add(leaf);
  }
  [rice, sauce, meat1, meat2].forEach((m) => (m.castShadow = true));
  food.add(rice, sauce, meat1, meat2, herbs);
  group.add(food);

  // ─── Couverts ───
  const fork = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.17), brushed);
  handle.position.z = 0.03;
  fork.add(handle);
  for (let i = 0; i < 4; i++) {
    const tine = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.003, 0.05), silver);
    tine.position.set(-0.0065 + i * 0.0043, 0, -0.08);
    fork.add(tine);
  }
  fork.position.set(-0.26, TABLE_Y + 0.003, 0.02);
  const knife = new THREE.Group();
  const kHandle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.1), brushed);
  kHandle.position.z = 0.06;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.002, 0.12), silver);
  blade.position.z = -0.05;
  knife.add(kHandle, blade);
  knife.position.set(0.26, TABLE_Y + 0.003, 0.02);
  [fork, knife].forEach((g) => g.traverse((o) => (o.castShadow = true)));
  group.add(fork, knife);

  // ─── Verre à pied ───
  const glass = new THREE.Mesh(
    lathe(
      [[0, 0], [0.034, 0], [0.034, 0.003], [0.004, 0.006], [0.0035, 0.09], [0.02, 0.105], [0.036, 0.14], [0.038, 0.18], [0.036, 0.2], [0.034, 0.2], [0.035, 0.18], [0.033, 0.142], [0.018, 0.108], [0, 0.1]],
      64,
    ),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.004, ior: 1.5, transparent: true }),
  );
  glass.position.set(0.24, TABLE_Y, -0.24);
  group.add(glass);

  // ─── Bougie et flamme ───
  const holder = new THREE.Mesh(lathe([[0, 0], [0.045, 0], [0.045, 0.006], [0.012, 0.012], [0.01, 0.05], [0.03, 0.058], [0.03, 0.064], [0, 0.064]], 48), silver);
  holder.position.set(-0.46, TABLE_Y, -0.38);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 32), new THREE.MeshStandardMaterial({ color: 0xf6f0e2, roughness: 0.7 }));
  candle.position.set(-0.46, TABLE_Y + 0.064 + 0.08, -0.38);
  const flameY = TABLE_Y + 0.064 + 0.16 + 0.018;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffd28a }));
  flame.scale.set(1, 2.2, 1);
  flame.position.set(-0.46, flameY, -0.38);
  // Halo de la flamme : dégradé radial dessiné dans un canvas
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g2 = c.getContext("2d")!;
  const grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,214,150,0.9)");
  grd.addColorStop(0.25, "rgba(255,170,80,0.35)");
  grd.addColorStop(1, "rgba(255,140,40,0)");
  g2.fillStyle = grd;
  g2.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(0.16, 0.16, 1);
  glow.position.copy(flame.position);
  const candleLight = new THREE.PointLight(0xffb366, 0.9, 2.2, 2);
  candleLight.position.set(-0.46, flameY + 0.02, -0.38);
  candleLight.castShadow = true;
  candleLight.shadow.mapSize.set(512, 512);
  group.add(holder, candle, flame, glow, candleLight);

  // ─── Cloche en argent ───
  const cloche = new THREE.Group();
  const domePts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    domePts.push([Math.cos(a) * 0.175, Math.sin(a) * 0.13]);
  }
  domePts.unshift([0.182, 0], [0.182, 0.006]);
  const dome = new THREE.Mesh(lathe(domePts, 128), silver);
  dome.material = silver.clone();
  (dome.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 32, 16), silver);
  knob.position.y = 0.145;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.018, 24), silver);
  stem.position.y = 0.132;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.003, 12, 128), blue);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.006;
  cloche.add(dome, knob, stem, band);
  cloche.traverse((o) => (o.castShadow = true));
  cloche.position.y = TABLE_Y + 0.012;
  group.add(cloche);

  // ─── Lumières : douche de lumière sur l'assiette, contre-jour bleu, bougie ───
  scene.add(new THREE.HemisphereLight(0xe3f1fb, 0x1d1d1b, 0.12));
  const spot = new THREE.SpotLight(0xfff3e0, 26, 6, Math.PI / 13, 0.85, 1.6);
  spot.position.set(0.3, 2.6, 1.1);
  spot.target.position.set(0, TABLE_Y, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  scene.add(spot, spot.target);
  const rimLight = new THREE.DirectionalLight(new THREE.Color(brand), 2.2);
  rimLight.position.set(-1.6, 1.6, -2);
  scene.add(rimLight);

  return { scene, cloche, food, flame, glow, candleLight };
}

export function TableScene({ progress, framing, reduced, brand, onReady, onFail, className }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x0c0c0b, 1);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-hidden", "true");

    const { scene, cloche, food, flame, glow, candleLight } = buildScene(brand);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.3;
    scene.fog = new THREE.Fog(0x0c0c0b, 2.4, 5);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    const look = new THREE.Vector3(0, TABLE_Y + 0.04, 0);
    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    let desktop = false;
    let size = { w: 1, h: 1 };
    let lastShift = NaN;
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // Même point de rupture que le CSS (lg = 1024 px de fenêtre, barre de défilement comprise)
      size = { w, h };
      lastShift = NaN;
      desktop = window.matchMedia("(min-width: 1024px)").matches && w / h > 1.1;
      if (desktop) {
        // Grand écran : la table est centrée dans l'espace libre à droite de la colonne de texte
        // (même grille que ServiceHero : conteneur max-w-6xl, marge de 32 px, colonne de 26 rem puis 30 rem dès 1280 px).
        const left = Math.max(0, (w - 1152) / 2) + 32;
        const textEnd = left + (window.matchMedia("(min-width: 1280px)").matches ? 480 : 416) + 40;
        const free = w - textEnd;
        camera.fov = 30 * Math.min(1.5, Math.max(1, 740 / free));
        camera.setViewOffset(w, h, -textEnd / 2, 0, w, h);
      } else {
        // Mobile et tablette : cadrage centré, on recule sur un écran étroit pour garder toute la table
        camera.fov = w / h < 0.8 ? 42 : 30;
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(el);

    const timer = new THREE.Timer();
    let smooth = progress.current ?? 0;
    let raf = 0;
    let ready = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      timer.update();
      const t = timer.getElapsed();
      const target = clamp01(progress.current ?? 0);
      smooth += (target - smooth) * (reduced ? 1 : 0.08);
      const p = ease(smooth);

      // Service : la cloche se soulève, s'incline et s'écarte vers la droite
      cloche.position.set(p * 0.42, TABLE_Y + 0.012 + p * 0.5 - Math.max(0, p - 0.7) * 0.15, -p * 0.1);
      cloche.rotation.set(-p * 0.25, 0, -p * 0.55);
      food.scale.setScalar(0.98 + p * 0.02);

      // Cadrage mobile : la scène glisse de l'espace sous l'accueil vers l'espace au-dessus du plat annoncé
      if (!desktop && framing?.current) {
        const shift = framing.current.rest + (framing.current.reveal - framing.current.rest) * p;
        if (Number.isNaN(lastShift) || Math.abs(shift - lastShift) > 0.5) {
          lastShift = shift;
          camera.setViewOffset(size.w, size.h, 0, -shift, size.w, size.h);
          camera.updateProjectionMatrix();
        }
      }

      // Caméra : léger travelling vers l'assiette, et parallaxe à la souris
      const sway = reduced ? 0 : 1;
      camera.position.set(pointer.x * 0.08 * sway + Math.sin(t * 0.15) * 0.02 * sway, 1.22 - p * 0.22 - pointer.y * 0.04 * sway, 2.35 - p * 0.95);
      camera.lookAt(look);

      // Bougie qui vacille
      if (!reduced) {
        const f = 0.85 + Math.sin(t * 9.1) * 0.05 + Math.sin(t * 23.7) * 0.04 + Math.sin(t * 3.3) * 0.06;
        candleLight.intensity = 0.9 * f;
        flame.scale.set(1, 2.2 * f, 1);
        glow.material.opacity = 0.85 * f;
      }
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        onReady?.();
      }
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // La scène est construite une fois ; progress est lu à chaque image via la référence
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, brand]);

  return <div ref={host} className={className} />;
}
