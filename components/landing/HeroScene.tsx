"use client";

/**
 * HeroScene.tsx
 * ---------------------------------------------------------------------------
 * Currency coins revolving on a single wide orbit, behind the centred hero copy
 * which sits in the hollow middle.
 *
 * This lives in its own module so `next/dynamic` with `ssr: false` has a real
 * import boundary to code-split against — the ~450 KB three.js bundle never
 * blocks the hero's text paint. Imported only from InvariantLanding.tsx.
 *
 * ONE ORBIT, NO JITTER
 * ---------------------------------------------------------------------------
 * All twelve coin centres sit on ONE circle: shared radius, zero height offset,
 * exactly even angular spacing. This file deliberately contains no positional
 * randomness at all.
 *
 * That is load-bearing. Successive earlier versions spread the coins through a
 * shell, then across two concentric bands, then added "small" radius and height
 * jitter to each — and every one of those read as scatter rather than as an
 * orbit, because the eye needs a single shared path to lock onto. If you are
 * tempted to add a little variation back for organic feel, vary the SPIN
 * (which changes nothing about position) rather than the placement.
 *
 * The coins stand UPRIGHT on the orbit rather than lying flat in it — each is
 * turned to face along the path and then stood on edge, so it reads as a wheel
 * rolling around the ring. See Coin for the two rotations that takes.
 *
 * ROTATIONS AT TWO LEVELS
 * ---------------------------------------------------------------------------
 * The orbit turns as one rigid ring, and every coin also spins on its own
 * cylinder axis, so faces sweep through the key light and flash as they come
 * round. Those two axes differ, which is why coins are nested two groups deep.
 *
 * WHY THE LIGHT RIG EXISTS
 * ---------------------------------------------------------------------------
 * These are near-pure metal: `metalness: 0.9` means almost no diffuse response,
 * so the coins are rendered almost entirely by what they reflect. On a charcoal
 * page that is a trap — metal facing near-black reflects near-black and the
 * geometry vanishes, which was the "not visible" failure of an earlier build.
 *
 * So the scene ships its own surroundings, as a soft-box rig of `<Lightformer>`s
 * inside `<Environment>` (see the Canvas below). An earlier revision used
 * visible emissive planes floating behind the geometry instead; against a flat
 * charcoal background those read as exactly what they are — hard-edged grey
 * rectangles — so they went once the Lightformer rig made them redundant.
 *
 * MONOCHROME PALETTE
 * ---------------------------------------------------------------------------
 * The reference this copies is warm gold; the coins here are silver, because
 * the brief was to copy the coins and NOT the palette. Every light is likewise
 * neutral — cool white, warm silver, graphite. They are not all the same white,
 * though: metal with nothing but one white around it reflects to flat grey. The
 * warm/cool spread is what separates the forms without introducing a hue.
 */

import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Group, Mesh, Texture } from "three";

/* ------------------------------------------------------------------------ */
/* Coin constants                                                            */
/* ------------------------------------------------------------------------ */

/** Currency marks struck into the coin faces, one per coin, cycled. */
const COIN_SYMBOLS = ["₿", "Ξ", "$", "€", "£", "¥"];

const COIN_COUNT = 12;

/**
 * ONE orbit. Every coin centre sits on this circle exactly — no per-coin radius
 * or height jitter anywhere in this file.
 *
 * That is the whole point: earlier revisions spread the coins across two bands
 * with radius and height offsets, and however small those offsets were, the
 * result read as scatter rather than as an orbit. A single shared path is what
 * makes the motion legible.
 */
const RING_RADIUS = 5.1;
/** Revolutions of the whole orbit, radians/sec. */
const RING_SPEED = 0.2;

/** Radius of one coin once scaled — the cylinder itself is authored at r=1. */
const COIN_SCALE = 0.62;
/**
 * How far the ring plane is leaned toward the camera, radians. Near 0 it is
 * edge-on and collapses to a line; past ~1.0 it flattens into a face-on
 * dartboard and the orbit stops reading as an orbit. ~35° is the Saturn view.
 */
const RING_LEAN = 0.62;

/**
 * The polished-silver body. Same material family as the rings this replaced, so
 * the coins sit in the charcoal theme rather than the reference's warm gold —
 * the brief was to copy the coins, not the palette.
 */
const COIN_METAL = {
  // White, so the struck-face texture below reproduces at its authored values —
  // `color` multiplies `map`, and tinting it grey once dimmed the faces twice.
  color: "#ffffff",
  // Deliberately short of full metal. At 0.9 a PBR surface has almost no
  // diffuse term, so the milled detail on the faces washed out into pure
  // reflection and the currency marks were unreadable. 0.62 keeps the coins
  // unmistakably metal while letting the strike show.
  metalness: 0.62,
  roughness: 0.24,
  // Metal shows mostly what it reflects, and half of this rig's sphere is the
  // dark page. Overdriving the env map keeps coins turning away from the key
  // light from going to slab black.
  envMapIntensity: 2.1,
};

/* ------------------------------------------------------------------------ */
/* Struck-face and reeded-edge textures                                      */
/* ------------------------------------------------------------------------ */

/**
 * Draws one coin face to a canvas: a milled rim, a recessed field, and the
 * currency mark.
 *
 * The same canvas drives both `map` and `bumpMap`. That works because the
 * artwork is already luminance-coded the way a bump map wants — the mark and
 * rim are drawn lighter than the field, so they read as raised. Painting a
 * separate height map would be more correct and, at this size on screen,
 * indistinguishable.
 */
const drawCoinFace = (symbol: string | null): HTMLCanvasElement => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const c = size / 2;

  // Field. Off-centre highlight so a flat disc still reads as struck metal
  // before any lighting is applied.
  const field = ctx.createRadialGradient(c * 0.75, c * 0.7, c * 0.1, c, c, c);
  field.addColorStop(0, "#e6e6ea");
  field.addColorStop(0.55, "#c6c6cd");
  field.addColorStop(1, "#9c9ca4");
  ctx.fillStyle = field;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  // Raised rim, then the incuse line just inside it.
  ctx.lineWidth = size * 0.055;
  ctx.strokeStyle = "#f2f2f5";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = size * 0.012;
  ctx.strokeStyle = "#83838c";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.79, 0, Math.PI * 2);
  ctx.stroke();

  // No mark means this is the reverse: struck blank apart from a plain inner
  // ring. A real coin's reverse does not repeat the obverse, and reusing the
  // obverse here put a MIRRORED currency glyph on the back of every coin that
  // turned away from the camera, which reads as a rendering bug.
  if (symbol === null) {
    ctx.lineWidth = size * 0.02;
    ctx.strokeStyle = "#adadb5";
    ctx.beginPath();
    ctx.arc(c, c, c * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    return canvas;
  }

  // The mark, drawn twice: a dark shadow offset down-right, then the light face
  // on top. That two-pass offset is the whole emboss illusion.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size * 0.52}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

  ctx.fillStyle = "#6f6f78";
  ctx.fillText(symbol, c + size * 0.014, c + size * 0.016);
  ctx.fillStyle = "#f4f4f7";
  ctx.fillText(symbol, c, c);

  return canvas;
};

/** Vertical stripes wrapped around the cylinder wall to fake a reeded edge. */
const drawReeding = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#8e8e97";
  ctx.fillRect(0, 0, 8, 2);
  ctx.fillStyle = "#f0f0f3";
  ctx.fillRect(0, 0, 4, 2);

  return canvas;
};

/* ------------------------------------------------------------------------ */
/* A single coin                                                             */
/* ------------------------------------------------------------------------ */

interface CoinConfig {
  /** Angle around the orbit, radians. Evenly spaced — no jitter. */
  angle: number;
  /** Per-coin spin rate, radians/sec. */
  spin: number;
  /** Index into COIN_SYMBOLS. */
  symbol: number;
}

interface CoinProps {
  config: CoinConfig;
  face: Texture;
  back: Texture;
  edge: Texture;
}

const Coin: FC<CoinProps> = ({ config, face, back, edge }) => {
  const spinRef = useRef<Mesh>(null);

  // Spin about the cylinder's own axis. This is why the mesh is nested inside
  // the stand-up group rather than carrying that rotation itself:
  // cylinderGeometry is built along local Y, so rotating THIS mesh's Y spins the
  // coin like a record regardless of how the parent has turned it. Baking the
  // stand-up and the spin into one Euler would make the spin axis drift.
  useFrame((_state, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * config.spin;
  });

  return (
    <group
      // Dead on the orbit: shared radius, zero height offset. Every coin centre
      // lies on the same circle, which is what stops the ring reading as
      // scatter.
      position={[
        Math.cos(config.angle) * RING_RADIUS,
        0,
        Math.sin(config.angle) * RING_RADIUS,
      ]}
      // Turn each coin's local frame to face along its own orbit. Without this
      // every coin would stand parallel to the same world axis and the ring
      // would look like a row of coins that happens to be bent into a circle.
      // With it, local Z is the tangent, so "upright" means upright RELATIVE TO
      // the orbit at that point.
      rotation={[0, -config.angle, 0]}
    >
      {/*
        The 90° stand-up. cylinderGeometry is authored along Y, so an unrotated
        coin lies flat in the ring plane; rotating X by a quarter turn puts the
        axis on the tangent and stands the coin on its edge, like a wheel
        rolling around the orbit.
      */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh ref={spinRef} scale={COIN_SCALE}>
          <cylinderGeometry args={[1, 1, 0.14, 64]} />
          {/* Cylinder material slots are ordered [wall, top cap, bottom cap]. */}
          <meshStandardMaterial
            attach="material-0"
            {...COIN_METAL}
            map={edge}
            bumpMap={edge}
            bumpScale={0.6}
          />
          <meshStandardMaterial
            attach="material-1"
            {...COIN_METAL}
            map={face}
            bumpMap={face}
            bumpScale={1.2}
          />
          <meshStandardMaterial
            attach="material-2"
            {...COIN_METAL}
            map={back}
            bumpMap={back}
            bumpScale={1.2}
          />
        </mesh>
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* The orbit                                                                 */
/* ------------------------------------------------------------------------ */

const Centrepiece: FC = () => {
  const orbit = useRef<Group>(null);

  /**
   * One texture per symbol, shared across every coin that uses it — six
   * textures for the whole ring rather than one per coin. Built in a memo
   * because they touch `document`, so they cannot exist until the client
   * renders.
   */
  const faces = useMemo<Texture[]>(
    () =>
      COIN_SYMBOLS.map((symbol) => {
        const texture = new CanvasTexture(drawCoinFace(symbol));
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 4;
        return texture;
      }),
    [],
  );

  /** One blank reverse, shared by every coin. */
  const back = useMemo<Texture>(() => {
    const texture = new CanvasTexture(drawCoinFace(null));
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, []);

  const edge = useMemo<Texture>(() => {
    const texture = new CanvasTexture(drawReeding());
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    // Repeat around the circumference only; the wall is one pixel tall in V.
    texture.repeat.set(90, 1);
    return texture;
  }, []);

  // Canvas textures are not managed by three's loader cache, so nothing else
  // will ever free them. Without this, every hot reload leaks another set.
  useEffect(
    () => () => {
      faces.forEach((texture) => texture.dispose());
      back.dispose();
      edge.dispose();
    },
    [faces, back, edge],
  );

  /**
   * Exactly even spacing around the one orbit. No positional jitter of any
   * kind — that is what the last few revisions kept getting wrong.
   *
   * Only the spin rate varies, and that changes nothing about where a coin sits:
   * it just stops all twelve flashing their faces in lockstep. Seeded rather
   * than Math.random() so it is stable across re-renders.
   */
  const coins = useMemo<CoinConfig[]>(
    () =>
      Array.from({ length: COIN_COUNT }, (_, i): CoinConfig => {
        // Cheap irrational-multiplier hash — spreads values without clustering.
        const jitter = (n: number) => (Math.sin(i * n) + 1) / 2;

        return {
          angle: (i / COIN_COUNT) * Math.PI * 2,
          spin: 0.25 + jitter(93.989) * 0.4,
          symbol: i % COIN_SYMBOLS.length,
        };
      }),
    [],
  );

  // The whole orbit turns as one rigid ring. Earlier revisions ran concentric
  // bands at different rates; with a single path there is nothing to shear
  // against, and one shared rate is what keeps the coins on that path.
  useFrame((_state, delta) => {
    if (orbit.current) orbit.current.rotation.y += delta * RING_SPEED;
  });

  return (
    // The orbit plane leaned toward the camera. Near 0 it would be edge-on and
    // collapse to a line; near PI/2 it would be face-on and read as a flat
    // dartboard. This is the three-quarter view between the two.
    <group rotation={[RING_LEAN, 0, 0.08]}>
      <group ref={orbit}>
        {coins.map((config, i) => (
          <Coin key={i} config={config} face={faces[config.symbol]} back={back} edge={edge} />
        ))}
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* Rig                                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Half-extent of the ring — the orbit radius plus one coin — so the fit maths
 * below has something to solve for.
 */
const CENTREPIECE_RADIUS = RING_RADIUS + COIN_SCALE;

const Rig: FC = () => {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);

  // Fit the orbit to whatever frame it is given, rather than switching on
  // viewport breakpoints. Solve the frustum: at the origin the visible height is
  // 2·tan(fov/2)·distance and the visible width is that times the aspect. Fit to
  // whichever is tighter and the ring sits correctly in a tall narrow phone and
  // a wide desktop alike, with no per-breakpoint magic numbers.
  const fov = "fov" in camera ? (camera.fov as number) : 45;
  const visibleHeight = 2 * Math.tan((fov * Math.PI) / 360) * camera.position.z;
  const visibleWidth = visibleHeight * (size.width / size.height);

  // Clamped at both ends: unbounded, a very wide frame inflates the ring past
  // the frame edge and a very short one shrinks it to a speck.
  const scale = Math.min(
    Math.max(Math.min(visibleWidth, visibleHeight) / 2 / CENTREPIECE_RADIUS, 0.3),
    1,
  );

  return (
    <group scale={scale}>
      <Centrepiece />
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* Canvas                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Exported as default so `dynamic(() => import("./HeroScene"))` resolves
 * without a `.then(m => m.X)` hop.
 */
const HeroScene: FC = () => {
  // A lost WebGL context (GPU reset, memory pressure, driver hiccup, tab
  // restored from bfcache) leaves an unpainted canvas that composites as a
  // solid block. Track it and fall back to the CSS glow instead.
  // `webglcontextrestored` puts the scene back.
  const [contextLost, setContextLost] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * The `webglcontextlost` event only fires for losses that happen AFTER the
   * listener is attached in onCreated. A context that dies during creation —
   * or one the browser refuses to grant because too many are already live —
   * never emits it, and the page silently shows an unpainted canvas with the
   * fallback hidden behind it. Poll as a backstop.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const lost = !gl || (gl as WebGLRenderingContext).isContextLost();
      setContextLost((current) => (current === lost ? current : lost));
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0">
      {/* Always-present ambient glow. Doubles as the loading state and as the
          fallback whenever the canvas cannot paint. */}
      <div className="absolute inset-0 grid place-items-center" aria-hidden>
        <div className="h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(232,232,236,0.14),rgba(148,152,162,0.07)_45%,transparent_72%)] blur-3xl" />
      </div>

      <Canvas
        className="absolute inset-0"
        style={{ opacity: contextLost ? 0 : 1, transition: "opacity 300ms" }}
        camera={{ position: [0, 0, 8.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvasRef.current = canvas;
          canvas.addEventListener("webglcontextlost", (e) => {
            // Preventing the default is what makes restoration possible.
            e.preventDefault();
            setContextLost(true);
          });
          canvas.addEventListener("webglcontextrestored", () => setContextLost(false));
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 6, 4]} intensity={2} color="#ffffff" />
        {/* Warm key from below-left, cool fill from above-right. Same trick as
            the CSS washes: temperature separation instead of hue. */}
        <pointLight position={[-6, -2, 3]} intensity={40} color="#e8dfd2" />
        <pointLight position={[6, 3, 2]} intensity={32} color="#cfd6e0" />

        <Rig />

        {/*
          Required for the glossy materials to reflect anything.

          Built from Lightformers rather than `preset="..."`. A preset fetches
          an HDRI from drei's CDN at runtime (raw.githack.com ->
          raw.githubusercontent.com), and on any network that blocks it the
          loader THROWS — which unmounts the whole canvas, not just the
          reflections. Rendering the environment in-process is offline-safe and,
          more to the point here, lets the reflections be explicitly neutral:
          every packaged preset is a photograph of a real room and carries its
          sky-blues and sodium-oranges straight back onto polished metal.

          This is a soft-box rig: a big white key above, dimmer warm/cool sides
          for temperature separation, and two bright strips that become the
          hard specular highlights running along the rings.
        */}
        <Environment resolution={256} frames={1}>
          <Lightformer
            form="rect"
            intensity={2.4}
            color="#ffffff"
            position={[0, 5, -6]}
            scale={[12, 6, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.1}
            color="#e8dfd2"
            position={[-7, 0, -3]}
            rotation={[0, Math.PI / 2.4, 0]}
            scale={[9, 7, 1]}
          />
          <Lightformer
            form="rect"
            intensity={0.9}
            color="#cfd6e0"
            position={[7, 1, -3]}
            rotation={[0, -Math.PI / 2.4, 0]}
            scale={[9, 7, 1]}
          />
          <Lightformer
            form="rect"
            intensity={3}
            color="#ffffff"
            position={[-2.5, 3, 4]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[1, 8, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            color="#ffffff"
            position={[3, -3, 3]}
            rotation={[0, 0, -Math.PI / 3.5]}
            scale={[0.8, 7, 1]}
          />
          {/* Floor bounce — keeps the underside off pure black. */}
          <Lightformer
            form="rect"
            intensity={0.5}
            color="#8a8d95"
            position={[0, -6, -2]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[12, 8, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
};

export default HeroScene;
