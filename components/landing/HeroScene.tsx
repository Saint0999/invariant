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
 * WHY THE LIGHT RIG EXISTS
 * ---------------------------------------------------------------------------
 * `transmission={1}` makes a surface behave like glass: it has almost no
 * colour of its own and instead refracts whatever is behind and around it. On
 * a charcoal page that is a trap — glass in front of near-black refracts
 * near-black, and the object vanishes, which is exactly the "not visible"
 * failure of the earlier fully-metallic version.
 *
 * So the scene ships its own light to refract, as a soft-box rig of
 * `<Lightformer>`s inside `<Environment>` (see the Canvas below). An earlier
 * revision used visible emissive planes floating behind the mesh instead;
 * against a flat charcoal background those read as exactly what they are —
 * hard-edged grey rectangles — so they were removed once the Lightformer rig
 * made them redundant.
 *
 * MONOCHROME PALETTE
 * ---------------------------------------------------------------------------
 * Every light is NEUTRAL — cool white, warm silver, graphite — to match the
 * page's charcoal theme. They are not all the same white, though: glass with
 * nothing but one white around it refracts to flat grey. The warm/cool spread
 * is what produces separation across the form without introducing a hue. For
 * the same reason `iridescence` is dialled well down from the old violet build
 * rather than off — a trace of it gives the chrome its edges, while a
 * full-strength value paints rainbows straight back onto the page.
 */

import { useEffect, useRef, useState, type FC } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Torus, TorusKnot } from "@react-three/drei";
import type { Group, Mesh } from "three";

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
  // Trace iridescence only — enough for the rim to catch, not enough to tint.
  iridescence: 0.25,
  iridescenceIOR: 1.4,
  iridescenceThicknessRange: [200, 500] as [number, number],
  ior: 1.55,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  // Neutral, a hair off pure white so the refraction has something to shift
  // against without reading as a colour.
  color: "#e8e8ec",
  metalness: 0,
  envMapIntensity: 1.6,
};

/**
 * The encircling rings: iridescent polished shells, no transmission. They read
 * as the same material family as the knot because they share its iridescence
 * and clearcoat, but cost a normal forward pass instead of a scene re-render.
 */
const shellProps = {
  roughness: 0.12,
  // Pushed up from 0.35: polished silver is what sells the charcoal theme, and
  // metalness is what makes the rings read as brushed metal rather than as
  // tinted plastic once the iridescence is turned down.
  metalness: 0.78,
  iridescence: 0.2,
  iridescenceIOR: 1.4,
  iridescenceThicknessRange: [200, 500] as [number, number],
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  color: "#c8c8ce",
  // Metal shows only what it reflects, and half of this rig's sphere is the
  // dark page. Overdriving the env map is what keeps the rings from going to
  // slab black on their away-facing side.
  envMapIntensity: 2.4,
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
  // The centrepiece is authored for a wide desktop frame. The same world units
  // fill a much narrower viewport proportionally larger, so it swamps the
  // headline — shrink it as the frame narrows, and lift it clear of the copy
  // on phones.
  //
  // Three steps rather than one breakpoint: a single 768px switch left the
  // laptop range (roughly 800–1100px) rendering at full size, where the outer
  // rings cut straight across the subheading and the network row.
  const width = useThree((state) => state.size.width);
  const scale = width < 768 ? 0.45 : width < 1150 ? 0.72 : 0.84;

  return (
    <group scale={scale} position={[0, width < 768 ? 1.2 : 0, 0]}>
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
