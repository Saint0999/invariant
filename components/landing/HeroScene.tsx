"use client";

/**
 * HeroScene.tsx
 * ---------------------------------------------------------------------------
 * A single abstract "node sphere" sitting BEHIND the centred hero content.
 *
 * This lives in its own module so `next/dynamic` with `ssr: false` has a real
 * import boundary to code-split against — the ~450 KB three.js bundle never
 * blocks the hero's text paint. Imported only from InvariantLanding.tsx.
 *
 * COMPOSITION
 * ---------------------------------------------------------------------------
 * Three coaxial layers rotating as one body:
 *   1. a faceted icosahedral core in glossy iridescent violet
 *   2. a larger wireframe shell, reading as the network graph
 *   3. emissive node spheres pinned to the shell's vertices
 *
 * LIGHTING AGAINST WHITE
 * ---------------------------------------------------------------------------
 * Making geometry read on a light page is the inverse of the dark-theme
 * problem. Chrome works on black because it is lit by its highlights; on white
 * those highlights ARE the background, so a metallic surface disappears. The
 * fix is pigment, not polish: low-metalness meshPhysicalMaterial in saturated
 * colour, with `clearcoat` doing the glossy work metalness used to. The
 * environment is under-driven (envMapIntensity below 1) because a near-white
 * env washes saturated colour straight back out to pastel.
 */

import { useMemo, useRef, useState, type FC } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Icosahedron, Lightformer } from "@react-three/drei";
import { IcosahedronGeometry, type Group } from "three";

/** Position triple, matching three's constructor order. */
type Vec3 = [x: number, y: number, z: number];

/* ------------------------------------------------------------------------ */
/* Geometry constants                                                        */
/* ------------------------------------------------------------------------ */

/** Radius of the solid inner core. */
const CORE_RADIUS = 1.15;
/** Radius of the wireframe shell and the node ring that sits on it. */
const SHELL_RADIUS = 1.72;
/**
 * Subdivision level for both shell and nodes. 1 gives 42 vertices — enough to
 * read as a network, few enough that the node spheres stay individually
 * legible. 2 would give 162 and turn into visual noise at this scale.
 */
const SHELL_DETAIL = 1;

/* ------------------------------------------------------------------------ */
/* Node sphere                                                               */
/* ------------------------------------------------------------------------ */

const NodeSphere: FC = () => {
  const group = useRef<Group>(null);

  /**
   * The wireframe's vertex positions, de-duplicated. IcosahedronGeometry is
   * non-indexed, so every vertex is repeated once per adjacent face — pinning
   * a mesh to each raw entry would stack five spheres on the same point and
   * pay for all of them. Rounding to 3dp is what makes the dedupe reliable:
   * shared vertices differ in the last float bits.
   */
  const nodes = useMemo<Vec3[]>(() => {
    const geometry = new IcosahedronGeometry(SHELL_RADIUS, SHELL_DETAIL);
    const position = geometry.attributes.position;
    const seen = new Set<string>();
    const points: Vec3[] = [];

    for (let i = 0; i < position.count; i += 1) {
      const x = Number(position.getX(i).toFixed(3));
      const y = Number(position.getY(i).toFixed(3));
      const z = Number(position.getZ(i).toFixed(3));
      const key = `${x}|${y}|${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push([x, y, z]);
    }

    // The geometry existed only to harvest positions; free its GPU buffers.
    geometry.dispose();
    return points;
  }, []);

  // Slow, continuous, two-axis drift. Deliberately not tied to scroll or
  // pointer so the object reads as a calm ambient presence.
  useFrame((_state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x += delta * 0.045;
  });

  return (
    <group ref={group}>
      {/* ---- 1. Faceted core ---------------------------------------- */}
      <Icosahedron args={[CORE_RADIUS, 0]}>
        <meshPhysicalMaterial
          color="#6d28d9"
          metalness={0.2}
          roughness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.04}
          // Kept low: at full strength the thin-film term dominates the base
          // pigment and the object washes out to pastel against white.
          iridescence={0.4}
          iridescenceIOR={1.6}
          iridescenceThicknessRange={[200, 700]}
          // Below 1 on purpose — the environment is near-white, so letting it
          // drive the shading desaturates the pigment.
          envMapIntensity={0.75}
          flatShading
        />
      </Icosahedron>

      {/* ---- 2. Wireframe shell ------------------------------------- */}
      <Icosahedron args={[SHELL_RADIUS, SHELL_DETAIL]}>
        {/*
          meshBasicMaterial, not standard: the wire should be a constant-weight
          graphic line, not a lit surface that fades out wherever it happens to
          face away from the key light.
        */}
        <meshBasicMaterial
          color="#8b5cf6"
          wireframe
          transparent
          opacity={0.42}
          // Without depthWrite:false the wire occludes the core's highlights
          // and the whole object flattens.
          depthWrite={false}
        />
      </Icosahedron>

      {/* ---- 3. Emissive nodes -------------------------------------- */}
      {nodes.map((position, i) => (
        <mesh key={`${position[0]}|${position[1]}|${position[2]}`} position={position}>
          <sphereGeometry args={[0.05, 16, 16]} />
          {/* Alternating accents keep the ring from reading as one flat dotted
              outline. Emissive is what makes them glow against the light page. */}
          <meshStandardMaterial
            color={i % 3 === 0 ? "#06b6d4" : "#7c3aed"}
            emissive={i % 3 === 0 ? "#06b6d4" : "#7c3aed"}
            emissiveIntensity={i % 3 === 0 ? 1.6 : 1.1}
            roughness={0.25}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* Rig                                                                       */
/* ------------------------------------------------------------------------ */

const Rig: FC = () => {
  // The scene is authored for a desktop-width frame. On a phone the same world
  // units fill a much narrower viewport, so the sphere swells up and collides
  // with the headline — shrink it and lift it clear instead.
  const isNarrow = useThree((state) => state.size.width) < 768;

  return (
    // On a phone the sphere is both shrunk and lifted well above centre: at
    // desktop proportions it lands squarely on the headline, and the legibility
    // mask is far smaller in absolute pixels at 390px wide so it cannot
    // compensate on its own.
    <group scale={isNarrow ? 0.5 : 1} position={[0, isNarrow ? 1.55 : 0.35, 0]}>
      <NodeSphere />
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
        <div className="h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(109,40,217,0.07),transparent_70%)] blur-3xl" />
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
        {/* Ambient is low because the surfaces are pigmented: flooding a
            saturated material with white ambient desaturates it. The
            directionals do the shaping. */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[4, 6, 4]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[-5, -2, 2]} intensity={1.1} color="#a5b4fc" />

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
