"use client";

/**
 * HeroScene.tsx
 * ---------------------------------------------------------------------------
 * The react-three-fiber scene that sits behind the hero.
 *
 * This lives in its own module for one reason: `next/dynamic` with
 * `ssr: false` needs a real import boundary to code-split against, so the
 * ~450 KB three.js bundle never blocks the hero's text paint. It is imported
 * only from InvariantLanding.tsx.
 *
 * Scene composition:
 *   - a glowing torus knot as the focal "protocol" object
 *   - two metallic coins orbiting it on offset float rhythms
 *   - drei's <Environment> for the studio reflections that give the reference
 *     images their chrome look
 *   - <Sparkles> for the fine particulate depth
 */

import { useRef, useState, type FC } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles, TorusKnot } from "@react-three/drei";
import type { Group, Mesh } from "three";

/* ------------------------------------------------------------------------ */
/* Focal object                                                              */
/* ------------------------------------------------------------------------ */

interface KnotProps {
  /** Radians per second around Y. */
  speed?: number;
}

const GlowKnot: FC<KnotProps> = ({ speed = 0.18 }) => {
  const ref = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * speed;
    ref.current.rotation.x += delta * speed * 0.35;
  });

  return (
    <Float speed={1.1} rotationIntensity={0.4} floatIntensity={0.9}>
      {/* args: radius, tube, tubularSegments, radialSegments, p, q */}
      <TorusKnot ref={ref} args={[1.05, 0.3, 220, 36, 2, 3]} scale={1.05}>
        <meshStandardMaterial
          color="#8ea2ff"
          metalness={0.95}
          roughness={0.14}
          // envMapIntensity is what actually makes a near-metal read as chrome.
          // A fully metallic surface has no diffuse response, so it is lit
          // entirely by the environment; at the default intensity of 1 the
          // Lightformer rig is too dim and the mesh collapses to black.
          envMapIntensity={2.2}
          emissive="#243a8f"
          emissiveIntensity={0.7}
        />
      </TorusKnot>
    </Float>
  );
};

/* ------------------------------------------------------------------------ */
/* Orbiting coins                                                            */
/* ------------------------------------------------------------------------ */

/** Euler / position triple, matching three's constructor order. */
type Vec3 = [x: number, y: number, z: number];

interface CoinProps {
  position: Vec3;
  rotation?: Vec3;
  /** Base tint of the coin's metal. */
  color?: string;
  /** Float cadence — vary per instance so the coins never sync up. */
  floatSpeed?: number;
  scale?: number;
}

const Coin: FC<CoinProps> = ({
  position,
  rotation = [Math.PI / 2.4, 0, 0.3],
  color = "#f3c78a",
  floatSpeed = 1.6,
  scale = 1,
}) => {
  const ref = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.5;
  });

  return (
    <Float speed={floatSpeed} rotationIntensity={0.7} floatIntensity={1.4}>
      <mesh ref={ref} position={position} rotation={rotation} scale={scale}>
        {/* args: radiusTop, radiusBottom, height, radialSegments */}
        <cylinderGeometry args={[0.62, 0.62, 0.1, 64]} />
        {/* Same reasoning as the knot — see the note on its material. Without
            the envMapIntensity boost the coin faces render as flat black
            silhouettes against the dark page. */}
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.22}
          envMapIntensity={2.6}
          emissive={color}
          emissiveIntensity={0.12}
        />
      </mesh>
    </Float>
  );
};

/* ------------------------------------------------------------------------ */
/* Scene graph                                                               */
/* ------------------------------------------------------------------------ */

const Rig: FC = () => {
  const group = useRef<Group>(null);

  // Gentle parallax that tracks the pointer — enough to read as interactive
  // without hijacking scroll or making the widget feel unstable.
  useFrame((state, delta) => {
    if (!group.current) return;
    const targetX = state.pointer.x * 0.28;
    const targetY = state.pointer.y * 0.18;
    group.current.rotation.y += (targetX - group.current.rotation.y) * delta * 2;
    group.current.rotation.x += (-targetY - group.current.rotation.x) * delta * 2;
  });

  return (
    // Nudged up and to the left so the knot reads around the glass widget
    // rather than sitting directly behind it on wide viewports.
    <group ref={group} position={[-0.45, 0.35, 0]}>
      <GlowKnot />
      <Coin position={[2.15, 1.1, -0.6]} color="#f6d19b" floatSpeed={1.5} />
      <Coin
        position={[-2.3, -1.15, 0.4]}
        color="#cfe0ff"
        floatSpeed={2.1}
        scale={0.78}
        rotation={[Math.PI / 3, 0.4, -0.2]}
      />
      <Sparkles count={60} scale={9} size={2.2} speed={0.3} opacity={0.5} color="#9fd4ff" />
    </group>
  );
};

/**
 * Exported as the default so `dynamic(() => import("./HeroScene"))` resolves
 * without a `.then(m => m.X)` hop.
 *
 * `dpr={[1, 2]}` caps the retina cost, and `frameloop="always"` is left on
 * because every object here animates — switch to "demand" if you ever make the
 * scene static.
 */
const HeroScene: FC = () => {
  // A lost WebGL context (GPU reset, memory pressure, driver hiccup, tab
  // restored from bfcache) leaves an unpainted canvas that composites as an
  // opaque white block — very visible on a dark page. Track it and swap in the
  // CSS glow instead. `webglcontextrestored` puts the scene back.
  const [contextLost, setContextLost] = useState<boolean>(false);

  return (
    <div className="absolute inset-0">
      {/* Always-present ambient glow. It doubles as the loading state and as
          the fallback whenever the canvas cannot paint. */}
      <div
        className="absolute inset-0 grid place-items-center"
        aria-hidden
      >
        <div className="h-72 w-72 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.4),rgba(34,211,238,0.15)_45%,transparent_70%)] blur-3xl" />
      </div>

      <Canvas
        className="absolute inset-0"
        style={{ opacity: contextLost ? 0 : 1, transition: "opacity 300ms" }}
        camera={{ position: [0, 0, 6.2], fov: 45 }}
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
    <ambientLight intensity={0.35} />
    <directionalLight position={[4, 5, 3]} intensity={2.2} color="#cbd8ff" />
    <pointLight position={[-5, -3, -2]} intensity={18} color="#f59e0b" />
    <pointLight position={[3, -2, 4]} intensity={12} color="#22d3ee" />

    <Rig />

    {/*
      Reflections are built in-scene from Lightformers rather than a drei
      `preset`, which would fetch an HDRI from a CDN at runtime. This keeps the
      page self-contained (no third-party request, works offline and behind a
      strict CSP) and gives finer control over the highlight shapes that read
      as "chrome" on the knot.
    */}
    {/*
      `frames={1}` bakes the cubemap once at mount. The lightformers below are
      static, so there is nothing to keep re-rendering — leaving this at the
      default would redraw the whole environment cubemap every animation frame.
    */}
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#05070c"]} />
      {/* Broad key from above */}
      <Lightformer intensity={4} position={[0, 5, -2]} scale={[10, 4, 1]} color="#dfe7ff" />
      {/* Cool rim, screen-left */}
      <Lightformer
        intensity={5}
        position={[-5, 1, 1]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[8, 2, 1]}
        color="#22d3ee"
      />
      {/* Warm rim, screen-right — the amber accent from the reference */}
      <Lightformer
        intensity={4}
        position={[5, -1, 1]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[8, 2, 1]}
        color="#f59e0b"
      />
      <Lightformer form="ring" intensity={3.5} position={[0, 0, 6]} scale={4} color="#8b5cf6" />
        </Environment>
      </Canvas>
    </div>
  );
};

export default HeroScene;
