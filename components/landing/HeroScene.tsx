"use client";

/**
 * HeroScene.tsx
 * ---------------------------------------------------------------------------
 * A large glass/iridescent centrepiece sitting BEHIND the centred hero text.
 *
 * This lives in its own module so `next/dynamic` with `ssr: false` has a real
 * import boundary to code-split against — the ~450 KB three.js bundle never
 * blocks the hero's text paint. Imported only from InvariantLanding.tsx.
 *
 * WHY THE GLOW RIG EXISTS
 * ---------------------------------------------------------------------------
 * `transmission={1}` makes a surface behave like glass: it has almost no
 * colour of its own and instead refracts whatever is behind and around it. On
 * a near-black page that is a trap — glass in front of black refracts black,
 * and the object vanishes, which is exactly the "not visible" failure of the
 * previous fully-metallic version.
 *
 * So the scene ships its own light sources to refract: a set of saturated
 * emissive panels sitting behind the mesh (`GlowPanels`). They are what give
 * the glass its violet/cyan chromatic edges. They also mean the centrepiece
 * still reads if <Environment> fails to load its HDRI from the CDN, which is a
 * real failure mode on locked-down networks.
 */

import { useEffect, useRef, useState, type FC } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Torus, TorusKnot } from "@react-three/drei";
import type { Group, Mesh } from "three";

/* ------------------------------------------------------------------------ */
/* Emissive backdrop panels                                                  */
/* ------------------------------------------------------------------------ */

interface PanelProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number];
  color: string;
  intensity?: number;
}

/**
 * A flat emissive plane. `toneMapped={false}` keeps the colour at full
 * saturation instead of being rolled off by the renderer's tone curve — these
 * are meant to read as pure light, not as lit surfaces.
 */
const GlowPanel: FC<PanelProps> = ({
  position,
  rotation = [0, 0, 0],
  scale = [6, 6],
  color,
  intensity = 1,
}) => (
  <mesh position={position} rotation={rotation}>
    <planeGeometry args={scale} />
    <meshBasicMaterial color={color} toneMapped={false} opacity={intensity} transparent />
  </mesh>
);

const GlowPanels: FC = () => (
  <group position={[0, 0, -6]}>
    <GlowPanel position={[-3.5, 1.5, 0]} color="#7c3aed" scale={[7, 7]} intensity={0.55} />
    <GlowPanel position={[3.5, -1, 0.5]} color="#06b6d4" scale={[7, 7]} intensity={0.5} />
    <GlowPanel position={[0, 3.5, -1]} color="#f472b6" scale={[6, 5]} intensity={0.35} />
    <GlowPanel position={[0, -3.5, -1]} color="#22d3ee" scale={[6, 5]} intensity={0.3} />
  </group>
);

/* ------------------------------------------------------------------------ */
/* The centrepiece                                                           */
/* ------------------------------------------------------------------------ */

/**
 * The transmissive glass, used for the KNOT ONLY.
 *
 * `transmission` is not a cheap flag: three.js renders the whole scene into a
 * separate transmission render target for every frame, per transmissive
 * material. Putting it on all three meshes tripled that cost and reliably
 * dropped the WebGL context on weaker GPUs. One glass hero, two cheaper
 * shells, same look.
 */
const glassProps = {
  transmission: 1,
  thickness: 2,
  roughness: 0.1,
  iridescence: 1,
  iridescenceIOR: 1.8,
  iridescenceThicknessRange: [100, 1000] as [number, number],
  ior: 1.55,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  // Slight tint. Pure white glass on a dark page reads as grey haze; a faint
  // cool cast gives the refraction something to shift against.
  color: "#dfe6ff",
  metalness: 0,
  envMapIntensity: 1.6,
};

/**
 * The encircling rings: iridescent polished shells, no transmission. They read
 * as the same material family as the knot because they share its iridescence
 * and clearcoat, but cost a normal forward pass instead of a scene re-render.
 */
const shellProps = {
  roughness: 0.08,
  metalness: 0.35,
  iridescence: 1,
  iridescenceIOR: 1.9,
  iridescenceThicknessRange: [100, 1000] as [number, number],
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  color: "#b9c7ff",
  envMapIntensity: 1.8,
};

const Centrepiece: FC = () => {
  const group = useRef<Group>(null);
  const knot = useRef<Mesh>(null);

  // Slow two-axis drift for the whole assembly, plus a slightly faster
  // counter-rotation on the knot so the nested forms shear against each other
  // instead of moving as one rigid lump.
  useFrame((_state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.13;
      group.current.rotation.x += delta * 0.04;
    }
    if (knot.current) {
      knot.current.rotation.z -= delta * 0.09;
    }
  });

  return (
    <group ref={group}>
      {/* Core knot — args: radius, tube, tubularSegments, radialSegments, p, q */}
      <TorusKnot ref={knot} args={[1.15, 0.42, 180, 32, 2, 3]}>
        <meshPhysicalMaterial {...glassProps} />
      </TorusKnot>

      {/* Two encircling rings, echoing the reference's orbital shells.
          args: radius, tube, radialSegments, tubularSegments */}
      <Torus args={[2.35, 0.13, 24, 120]} rotation={[Math.PI / 2.6, 0.3, 0]}>
        <meshPhysicalMaterial {...shellProps} />
      </Torus>
      <Torus args={[2.75, 0.1, 24, 120]} rotation={[Math.PI / 1.8, -0.5, 0.6]}>
        <meshPhysicalMaterial {...shellProps} />
      </Torus>
    </group>
  );
};

/* ------------------------------------------------------------------------ */
/* Rig                                                                       */
/* ------------------------------------------------------------------------ */

const Rig: FC = () => {
  // The centrepiece is authored for a desktop-width frame. On a phone the same
  // world units fill a much narrower viewport, so it swamps the headline —
  // shrink and lift it instead.
  const isNarrow = useThree((state) => state.size.width) < 768;

  return (
    <group scale={isNarrow ? 0.62 : 1} position={[0, isNarrow ? 1.2 : 0, 0]}>
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
        <div className="h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.22),rgba(6,182,212,0.10)_45%,transparent_72%)] blur-3xl" />
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
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 4]} intensity={2} color="#ffffff" />
        <pointLight position={[-6, -2, 3]} intensity={45} color="#7c3aed" />
        <pointLight position={[6, 3, 2]} intensity={35} color="#22d3ee" />

        {/* Behind the glass, so it has something saturated to refract. */}
        <GlowPanels />

        <Rig />

        {/*
          Required for the glossy materials to reflect anything. This fetches an
          HDRI from drei's CDN at runtime (raw.githack.com ->
          raw.githubusercontent.com); on a network where that is blocked the
          reflections are lost, but unlike the previous metallic version the
          centrepiece still reads, because GlowPanels above supplies in-scene
          colour for the glass to refract.
        */}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default HeroScene;
