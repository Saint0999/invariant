"use client";

/**
 * HeroScene.tsx
 * ---------------------------------------------------------------------------
 * The react-three-fiber scene that sits BEHIND the centred hero content.
 *
 * This lives in its own module so `next/dynamic` with `ssr: false` has a real
 * import boundary to code-split against — the ~450 KB three.js bundle never
 * blocks the hero's text paint. Imported only from InvariantLanding.tsx.
 *
 * LIGHT-THEME NOTES
 * ---------------------------------------------------------------------------
 * Lighting a metal against white is the inverse of the dark version's problem.
 * On a dark page a chrome object reads through its bright highlights; on white
 * it reads through its *shadows*, so the environment is deliberately not blown
 * out — the lightformers are dimmed and the materials carry a cool grey tint
 * so the geometry stays visible against #FCFCFC without turning muddy.
 *
 * The composition is a wide ring of objects rather than one centred hero prop:
 * the headline occupies the middle of the screen, so the geometry is pushed
 * outward and the page paints a radial white mask over the centre (see the
 * "legibility mask" layer in InvariantLanding.tsx).
 */

import { useRef, useState, type FC } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, TorusKnot } from "@react-three/drei";
import type { Group, Mesh } from "three";

/** Position / Euler triple, matching three's constructor order. */
type Vec3 = [x: number, y: number, z: number];

/* ------------------------------------------------------------------------ */
/* Focal object                                                              */
/* ------------------------------------------------------------------------ */

interface KnotProps {
  /** Radians per second around Y. */
  speed?: number;
}

const GlowKnot: FC<KnotProps> = ({ speed = 0.16 }) => {
  const ref = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * speed;
    ref.current.rotation.x += delta * speed * 0.35;
  });

  return (
    <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.8}>
      {/* args: radius, tube, tubularSegments, radialSegments, p, q */}
      {/* Small and lifted above centre: the headline owns the middle of the
          screen, so the knot reads as an accent behind the app-icon badge
          rather than a backdrop the type has to fight. */}
      <TorusKnot ref={ref} args={[1.05, 0.3, 220, 36, 2, 3]} scale={0.62} position={[0, 1.5, -1]}>
        <meshStandardMaterial
          // Cool light grey rather than a saturated colour — on white, tint is
          // what separates the object from the page, and anything stronger
          // reads as the neon look this redesign is moving away from.
          color="#c9d2e0"
          metalness={0.85}
          roughness={0.2}
          // Well below the dark theme's 2.2: a blown-out env map washes the
          // object into the white background and it disappears entirely.
          envMapIntensity={1.1}
        />
      </TorusKnot>
    </Float>
  );
};

/* ------------------------------------------------------------------------ */
/* Orbiting coins                                                            */
/* ------------------------------------------------------------------------ */

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
  color = "#d8dee9",
  floatSpeed = 1.6,
  scale = 1,
}) => {
  const ref = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.5;
  });

  return (
    <Float speed={floatSpeed} rotationIntensity={0.7} floatIntensity={1.3}>
      <mesh ref={ref} position={position} rotation={rotation} scale={scale}>
        {/* args: radiusTop, radiusBottom, height, radialSegments */}
        <cylinderGeometry args={[0.62, 0.62, 0.1, 64]} />
        <meshStandardMaterial
          color={color}
          metalness={0.8}
          roughness={0.25}
          envMapIntensity={1.1}
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
  // without hijacking scroll or destabilising the centred type.
  useFrame((state, delta) => {
    if (!group.current) return;
    const targetX = state.pointer.x * 0.22;
    const targetY = state.pointer.y * 0.14;
    group.current.rotation.y += (targetX - group.current.rotation.y) * delta * 2;
    group.current.rotation.x += (-targetY - group.current.rotation.x) * delta * 2;
  });

  return (
    <group ref={group}>
      <GlowKnot />
      {/* Coins pushed well outboard and kept small so they frame the headline
          from the margins instead of sitting under it. */}
      <Coin position={[3.9, -1.1, -1]} color="#dfe5ee" floatSpeed={1.5} scale={0.5} />
      <Coin
        position={[-3.7, 0.7, -1.5]}
        color="#d3dae6"
        floatSpeed={2.1}
        scale={0.42}
        rotation={[Math.PI / 3, 0.4, -0.2]}
      />
      <Coin
        position={[-2.8, -2.1, -2]}
        color="#e4e9f1"
        floatSpeed={1.8}
        scale={0.3}
        rotation={[Math.PI / 2.8, -0.3, 0.5]}
      />
    </group>
  );
};

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
        <div className="h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0.05),transparent_70%)] blur-3xl" />
      </div>

      <Canvas
        className="absolute inset-0"
        style={{ opacity: contextLost ? 0 : 1, transition: "opacity 300ms" }}
        camera={{ position: [0, 0, 7.5], fov: 45 }}
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
        {/* Brighter ambient than the dark theme so shadowed faces don't read as
            dirty smudges on a white page. */}
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 4]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-5, -2, 2]} intensity={0.7} color="#cfd8e6" />

        <Rig />

        {/*
          Reflections come from an in-scene Lightformer rig, not a drei
          `preset` — presets fetch an HDRI from a CDN at runtime, which leaves
          the canvas blank when the request fails and breaks under a strict CSP.

          `frames={1}` bakes the cubemap once at mount; the lightformers are
          static, so leaving it at the default would redraw the entire
          environment cubemap every animation frame.
        */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={["#e9edf3"]} />
          <Lightformer intensity={1.4} position={[0, 5, -2]} scale={[10, 4, 1]} color="#ffffff" />
          <Lightformer
            intensity={1.1}
            position={[-5, 1, 1]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[8, 2, 1]}
            color="#dfe7f5"
          />
          <Lightformer
            intensity={0.9}
            position={[5, -1, 1]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[8, 2, 1]}
            color="#c3cddd"
          />
        </Environment>
      </Canvas>
    </div>
  );
};

export default HeroScene;
