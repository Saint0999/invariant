"use client";

/**
 * HeroScene.tsx
 * ---------------------------------------------------------------------------
 * A ring of polished metal coins orbiting the centre of the hero, sitting
 * BEHIND the centred text. The ring is deliberately hollow in the middle so
 * the headline lands in the gap rather than on top of the geometry.
 *
 * This lives in its own module so `next/dynamic` with `ssr: false` has a real
 * import boundary to code-split against — the ~450 KB three.js bundle never
 * blocks the hero's text paint. Imported only from InvariantLanding.tsx.
 *
 * TWO ROTATIONS
 * ---------------------------------------------------------------------------
 * The whole ring revolves around Y, and every coin independently spins on its
 * own cylinder axis so faces sweep through the light and flash. Those axes are
 * different, which is why coins are nested two groups deep — see Coin below.
 *
 * ENVIRONMENT DEPENDENCY (important)
 * ---------------------------------------------------------------------------
 * `metalness={1}` means these surfaces have NO diffuse response: their entire
 * appearance is the reflected environment. <Environment preset="city" /> loads
 * that HDRI from drei's CDN at runtime, so if the request is blocked (offline,
 * strict CSP, locked-down network) the coins render black or disappear
 * completely. A local, zero-network fallback rig is included below, commented
 * out — swap to it if you hit that.
 */

import { useMemo, useRef, useState, type FC } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import type { Group, Mesh } from "three";

/* ------------------------------------------------------------------------ */
/* Scene constants                                                           */
/* ------------------------------------------------------------------------ */

/** Every coin shares this exact colour — no per-coin tinting. */
const COIN_COLOR = "#DFAE58";
/** How many coins sit in the orbit. */
const COIN_COUNT = 18;
/** Orbit radius, in world units. Large enough to leave the centre clear. */
const RING_RADIUS = 4.4;
/** Uniform coin scale. The geometry itself stays at the specified args. */
const COIN_SCALE = 0.24;

interface CoinConfig {
  /** Angle around the ring, radians. */
  angle: number;
  /** Vertical offset, so the ring reads as a scattered band not a flat disc. */
  y: number;
  /** Push in/out of the orbit for depth variation. */
  radiusOffset: number;
  /** Static lean, so coins present at different angles to the camera. */
  tilt: number;
  /** Per-coin spin rate, radians/sec. */
  spin: number;
}

/* ------------------------------------------------------------------------ */
/* A single coin                                                             */
/* ------------------------------------------------------------------------ */

const Coin: FC<{ config: CoinConfig }> = ({ config }) => {
  const spinRef = useRef<Mesh>(null);

  // Spin about the cylinder's own axis. This is why the mesh is nested inside
  // the tilted group rather than carrying the tilt itself: cylinderGeometry is
  // built along local Y, so rotating THIS mesh's Y spins the coin like a record
  // regardless of how the parent has leaned it. Baking tilt and spin into one
  // Euler would make the spin axis drift with the tilt.
  useFrame((_state, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * config.spin;
  });

  const radius = RING_RADIUS + config.radiusOffset;

  return (
    <group
      position={[Math.cos(config.angle) * radius, config.y, Math.sin(config.angle) * radius]}
    >
      {/* Stand the coin up to face the camera, then lean it by `tilt`. */}
      <group rotation={[Math.PI / 2, 0, config.tilt]}>
        <mesh ref={spinRef} scale={COIN_SCALE}>
          <cylinderGeometry args={[1, 1, 0.1, 32]} />
          <meshStandardMaterial color={COIN_COLOR} metalness={1} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* The orbiting ring                                                         */
/* ------------------------------------------------------------------------ */

const CoinRing: FC = () => {
  const ring = useRef<Group>(null);

  /**
   * Deterministic pseudo-random layout. Seeded arithmetic rather than
   * Math.random() so the arrangement is stable across re-renders — with
   * Math.random() every React re-render would reshuffle the whole ring.
   */
  const coins = useMemo<CoinConfig[]>(
    () =>
      Array.from({ length: COIN_COUNT }, (_, i) => {
        const angle = (i / COIN_COUNT) * Math.PI * 2;
        // Cheap irrational-multiplier hash — spreads values without clustering.
        const jitter = (n: number) => (Math.sin(i * n) + 1) / 2;

        return {
          angle,
          y: (jitter(12.9898) - 0.5) * 4.2,
          radiusOffset: (jitter(78.233) - 0.5) * 1.6,
          tilt: jitter(43.758) * Math.PI,
          spin: 0.25 + jitter(93.989) * 0.5,
        };
      }),
    [],
  );

  // Slow revolution of the entire orbit.
  useFrame((_state, delta) => {
    if (ring.current) ring.current.rotation.y += delta * 0.14;
  });

  return (
    <group ref={ring}>
      {coins.map((config, i) => (
        <Coin key={i} config={config} />
      ))}
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* Rig                                                                       */
/* ------------------------------------------------------------------------ */

const Rig: FC = () => {
  // The ring is authored for a desktop-width frame. On a phone the same world
  // units fill a much narrower viewport, so it crowds the headline — pull the
  // whole orbit down in scale instead.
  const isNarrow = useThree((state) => state.size.width) < 768;

  return (
    <group scale={isNarrow ? 0.72 : 1} rotation={[0.18, 0, 0]}>
      <CoinRing />
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
  // solid block. Track it and fall back to the CSS wash instead.
  // `webglcontextrestored` puts the scene back.
  const [contextLost, setContextLost] = useState<boolean>(false);

  return (
    <div className="absolute inset-0">
      {/* Always-present ambient wash. Doubles as the loading state and as the
          fallback whenever the canvas cannot paint. */}
      <div className="absolute inset-0 grid place-items-center" aria-hidden>
        <div className="h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(180,140,70,0.10),transparent_70%)] blur-3xl" />
      </div>

      <Canvas
        className="absolute inset-0"
        style={{ opacity: contextLost ? 0 : 1, transition: "opacity 300ms" }}
        camera={{ position: [0, 0, 9.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            // Preventing the default is what makes restoration possible.
            e.preventDefault();
            setContextLost(true);
          });
          canvas.addEventListener("webglcontextrestored", () => setContextLost(false));
        }}
      >
        {/* Direct lights only sharpen the specular hits; at metalness 1 the
            Environment below is what actually renders these surfaces. */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 6, 4]} intensity={1.6} color="#fff6e2" />
        <directionalLight position={[-5, -2, 3]} intensity={0.8} color="#cfd8e6" />

        <Rig />

        {/*
          Loads the "city" HDRI from drei's CDN at runtime
          (raw.githack.com -> raw.githubusercontent.com). See the note at the
          top of this file: at metalness 1 these coins have no appearance
          except this reflection, so if the request is blocked they render as
          near-invisible pale discs.

          Zero-network replacement — swap the line below for this block, and
          add `Lightformer` to the drei import above:

            <Environment resolution={256} frames={1}>
              <color attach="background" args={["#f0ece4"]} />
              <Lightformer intensity={2} position={[0, 5, -2]} scale={[10, 4, 1]} color="#fff3dc" />
              <Lightformer intensity={1.6} position={[-5, 1, 1]} rotation={[0, Math.PI / 2, 0]} scale={[8, 2, 1]} color="#ffffff" />
              <Lightformer intensity={1.2} position={[5, -1, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 2, 1]} color="#e8d9bd" />
            </Environment>

          Note that a flat white studio rig like that one reflects as flat
          white, so the coins stay pale. Real contrast needs dark stops in the
          environment — which is what the city HDRI provides.
        */}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default HeroScene;
