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
import LightRays from "./LightRays";

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
/**
 * Revolution of the whole orbit, radians/sec. Slow on purpose — this sits
 * behind the headline, so it wants to read as ambient drift rather than as
 * something asking to be watched. A full circuit takes about a minute.
 */
const RING_SPEED = 0.11;

/** Radius of one coin once scaled — the cylinder itself is authored at r=1. */
const COIN_SCALE = 0.62;
/**
 * How far the ring plane is leaned toward the camera, radians. Near 0 it is
 * edge-on and collapses to a line; past ~1.0 it flattens into a face-on
 * dartboard and the orbit stops reading as an orbit. ~35° is the Saturn view.
 */
const RING_LEAN = 0.66;
/**
 * Roll of the orbit around the view axis, radians. Tips the ellipse off
 * horizontal so the ring reads as an object caught at an angle rather than as a
 * level plate sitting square to the frame.
 */
const RING_ROLL = 0.44;

/**
 * The polished-silver body. Same material family as the rings this replaced, so
 * the coins sit in the charcoal theme rather than the reference's warm gold —
 * the brief was to copy the coins, not the palette.
 */
const COIN_METAL = {
  /*
    FULL metal. An intermediate value like 0.6 is not "a bit less shiny" — in a
    PBR model it is a surface that is physically half dielectric, and a half
    dielectric with a painted-looking albedo is exactly the recipe for cheap
    plastic. That was the previous value, and that is what it looked like.

    The reason it was lowered is that at full metalness there is no diffuse
    term, so the struck detail stopped reading. The fix is to put that detail
    where a real coin actually carries it — in the RELIEF and the POLISH, not in
    the albedo. Hence the strong bumpMap and the roughnessMap on every face
    below: the mark now shows because it catches the light differently, which is
    also why it survives being pure metal.
  */
  metalness: 1,
  /*
    NO CLEARCOAT.

    This is the fix for the waxy look, and it is worth stating plainly so it
    does not get "improved" back in: clearcoat models a transparent dielectric
    layer sitting ON TOP of the base — lacquer, car paint, a varnished surface.
    Over bare metal that is physically wrong, and it looks wrong in exactly the
    way that was reported: the coat adds a second, broad, WHITE specular lobe
    that has nothing to do with the gold underneath, and a soft white sheen
    floating over a warm body is precisely how wax reads.

    Polish on real metal does not come from a coat. It comes from low roughness,
    which is what makes the reflection sharp — see below.
  */
  clearcoat: 0,
  /*
    Sharper than before. Roughness is what "polished" actually means on metal:
    it controls how tightly the surroundings are mirrored, so a low value gives
    hard-edged reflections and crisp highlight streaks, where a higher one
    smears them into the broad soft glow that was reading as wax.

    Still modulated per-texel by roughnessMap, so the field, rim and mark do not
    all mirror identically — perfectly uniform roughness is its own CG tell.
  */
  roughness: 0.085,
  /*
    GOLD, darker than the first pass.

    On metal, `color` tints the reflection rather than lightening a base coat,
    so this one value carries the whole material: the coin reflects the light
    box through a gold filter. Deep on purpose — a light gold plus a bright
    environment is what pushed the front-facing coins to a pale, waxy yellow.
    Most of the perceived brightness should come from the specular streaks, not
    from the body.

    The face artwork it multiplies is drawn in NEUTRAL greys (see drawCoinFace).
    That is deliberate: the greys used to carry a slight blue cast, which fought
    this tint and desaturated the gold toward brass.
  */
  color: "#8f6526",
  // Gold absorbs most of the blue channel, so the same environment lands dimmer
  // on it than on a neutral body. Safe to run a little higher now that the
  // white clearcoat lobe is gone — that, not this, was what clipped the fronts.
  envMapIntensity: 1.45,
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
const drawCoinFace = (symbol: string): HTMLCanvasElement => {
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
  field.addColorStop(0, "#e8e8e8");
  field.addColorStop(0.55, "#c8c8c8");
  field.addColorStop(1, "#9e9e9e");
  ctx.fillStyle = field;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  // Raised rim, then the incuse line just inside it.
  ctx.lineWidth = size * 0.055;
  ctx.strokeStyle = "#f4f4f4";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = size * 0.012;
  ctx.strokeStyle = "#858585";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.79, 0, Math.PI * 2);
  ctx.stroke();

  // The mark, drawn twice: a dark shadow offset down-right, then the light face
  // on top. That two-pass offset is the whole emboss illusion.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size * 0.52}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

  ctx.fillStyle = "#707070";
  ctx.fillText(symbol, c + size * 0.014, c + size * 0.016);
  ctx.fillStyle = "#f6f6f6";
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

  ctx.fillStyle = "#909090";
  ctx.fillRect(0, 0, 8, 2);
  ctx.fillStyle = "#f2f2f2";
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
          {/*
            Cylinder material slots are ordered [wall, top cap, bottom cap].

            meshPhysicalMaterial rather than meshStandardMaterial purely for
            `clearcoat`, which standard does not implement — the coat is what
            gives the polished highlight.

            Each face texture is bound three ways: as `map` to tint the
            reflection, as `bumpMap` for the relief, and as `roughnessMap` so the
            mark and rim take polish differently from the field. That last one is
            what keeps the strike legible now that these are full metal with no
            diffuse term to carry it.
          */}
          <meshPhysicalMaterial
            attach="material-0"
            {...COIN_METAL}
            map={edge}
            bumpMap={edge}
            bumpScale={0.7}
            roughnessMap={edge}
          />
          <meshPhysicalMaterial
            attach="material-1"
            {...COIN_METAL}
            map={face}
            bumpMap={face}
            bumpScale={0.85}
            roughnessMap={face}
          />
          <meshPhysicalMaterial
            attach="material-2"
            {...COIN_METAL}
            map={back}
            bumpMap={back}
            bumpScale={0.85}
            roughnessMap={back}
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
  const { faces, backs } = useMemo(() => {
    const faces: Texture[] = [];
    const backs: Texture[] = [];

    for (const symbol of COIN_SYMBOLS) {
      // One canvas per symbol, sampled twice — the two sides differ only in how
      // they are read, so there is no reason to draw the artwork again.
      const canvas = drawCoinFace(symbol);

      const front = new CanvasTexture(canvas);
      front.colorSpace = SRGBColorSpace;
      front.anisotropy = 4;
      faces.push(front);

      const back = new CanvasTexture(canvas);
      back.colorSpace = SRGBColorSpace;
      back.anisotropy = 4;
      /*
        three's cylinder caps are UV-mirrored against each other: generateCap
        multiplies the V coordinate by +1 on the top and -1 on the bottom. So
        the identical artwork lands upside down on the reverse, which is why an
        earlier revision struck the reverse blank rather than showing a flipped
        mark.

        Flipping V back in the sampler fixes it properly, and costs a repeat and
        an offset rather than a second canvas: v' = 1 - v.
      */
      back.repeat.set(1, -1);
      back.offset.set(0, 1);
      backs.push(back);
    }

    return { faces, backs };
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
      backs.forEach((texture) => texture.dispose());
      edge.dispose();
    },
    [faces, backs, edge],
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
          // Kept in the same slow register as the orbit itself, and still
          // varied per coin so the twelve do not flash their faces in lockstep.
          spin: 0.13 + jitter(93.989) * 0.2,
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
    <group rotation={[RING_LEAN, 0, RING_ROLL]}>
      <group ref={orbit}>
        {coins.map((config, i) => (
          <Coin
            key={i}
            config={config}
            face={faces[config.symbol]}
            back={backs[config.symbol]}
            edge={edge}
          />
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

        {/*
          Volumetric rays washing down from above the header. Warm rather than
          white, so they belong to the same light as the gold coins, and low
          intensity — this is atmosphere behind the headline, not a spotlight.
          Draws behind the coins; see LightRays for why it lives in this canvas
          rather than being the upstream drop-in component.
        */}
        <LightRays
          raysOrigin="top-center"
          raysColor="#f2e3c8"
          raysSpeed={0.7}
          lightSpread={0.38}
          rayLength={2.6}
          fadeDistance={1.2}
          saturation={0.85}
          followMouse
          mouseInfluence={0.08}
          intensity={1.05}
        />

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

          This is a CLOSED light box, not a few floating panels. That matters
          now that the coins are full metal: metal has no diffuse term, so every
          direction it can reflect has to contain something. The earlier rig lit
          only part of the sphere and left the rest black, and once metalness
          went to 1 the coins reflected mostly that black and went nearly
          invisible. Six dim walls give a floor of reflected light everywhere;
          the bright strips on top of them supply the highlights.
        */}
        <Environment resolution={256} frames={1}>
          {/* --- The box. Dim, and warm on one side, cool on the other, so a
                  turning coin shifts temperature instead of staying flat. --- */}
          <Lightformer
            form="rect"
            intensity={2.8}
            color="#e8dfd2"
            position={[-9, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[18, 18, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2.6}
            color="#cfd6e0"
            position={[9, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[18, 18, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2.3}
            color="#d6d6dc"
            position={[0, 0, -9]}
            scale={[18, 18, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2.0}
            color="#c4c4cc"
            position={[0, 0, 9]}
            rotation={[0, Math.PI, 0]}
            scale={[18, 18, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.6}
            color="#9a9aa2"
            position={[0, -9, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[18, 18, 1]}
          />

          {/* --- Key: a broad soft-box overhead, the brightest thing in the
                  sphere and the source of the main sheen. --- */}
          <Lightformer
            form="rect"
            intensity={4.5}
            color="#ffffff"
            position={[0, 8, -1]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[14, 10, 1]}
          />

          {/* --- Strips. Narrow and bright, so they reflect as tight streaks
                  that slide across a coin as it turns. This is the detail that
                  reads as "polished" rather than merely "light grey". --- */}
          <Lightformer
            form="rect"
            intensity={3.1}
            color="#ffffff"
            position={[-3.5, 2.5, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[0.7, 10, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2.7}
            color="#ffffff"
            position={[3.5, -2, 5]}
            rotation={[0, 0, -Math.PI / 3.5]}
            scale={[0.5, 9, 1]}
          />
          <Lightformer
            form="rect"
            intensity={3}
            color="#f2ece2"
            position={[5, 4, 2]}
            rotation={[0, -Math.PI / 4, Math.PI / 5]}
            scale={[0.5, 8, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
};

export default HeroScene;
