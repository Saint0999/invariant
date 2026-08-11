"use client";

/**
 * LightRays.tsx
 * ---------------------------------------------------------------------------
 * Volumetric light rays fanning down over the hero.
 *
 * Adapted from React Bits "Light Rays" (https://reactbits.dev/backgrounds/light-rays,
 * MIT, github.com/DavidHDev/react-bits). The FRAGMENT SHADER below is the
 * upstream one, unchanged — it is the whole look, and rewriting it would only
 * risk losing it.
 *
 * WHY THIS IS NOT THE UPSTREAM COMPONENT
 * ---------------------------------------------------------------------------
 * The published component ships its own `ogl` renderer, which would mean a
 * second WebGL library and — more importantly — a SECOND WebGL context on a
 * page that already runs one for the coin ring. Browsers cap live contexts, and
 * HeroScene already carries explicit context-loss handling because that limit
 * has bitten here before. So the shader is mounted as a fullscreen quad inside
 * the canvas we already have: no new dependency, no second context, and it
 * shares the existing render loop and loss fallback.
 *
 * The trade is that this is an R3F component rather than a drop-in <div>, so it
 * must be rendered inside a <Canvas>. Upstream's `className`, its intersection
 * observer and its own RAF loop are all dropped — R3F stops the loop when the
 * canvas is offscreen anyway.
 */

import { useEffect, useMemo, useRef, type FC } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad } from "@react-three/drei";
import { AddEquation, Color, CustomBlending, OneFactor, Vector2 } from "three";
import type { Mesh } from "three";

export type RaysOrigin =
  | "top-center"
  | "top-left"
  | "top-right"
  | "right"
  | "left"
  | "bottom-center"
  | "bottom-right"
  | "bottom-left";

export interface LightRaysProps {
  /** Where the rays emanate from. */
  raysOrigin?: RaysOrigin;
  /** Ray colour, hex. */
  raysColor?: string;
  raysSpeed?: number;
  /** Lower is a tighter fan, higher is a wider wash. */
  lightSpread?: number;
  /** How far the rays reach, as a multiple of viewport width. */
  rayLength?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  /** 0 is greyscale, 1 is the full ray colour. */
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  /** Overall multiplier, applied on top of the shader. Not an upstream prop. */
  intensity?: number;
}

/*
  A ScreenQuad's `position` attribute is a vec2 already in clip space, so this
  needs RawShaderMaterial rather than ShaderMaterial: three's ShaderMaterial
  prelude declares `attribute vec3 position` for you, which would collide with
  the vec2 the geometry actually supplies.
*/
const VERTEX = /* glsl */ `
precision highp float;

attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** Upstream fragment shader, verbatim. */
const FRAGMENT = /* glsl */ `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float uIntensity;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  // Local addition on top of the upstream shader. It has to be a uniform: the
  // blend is straight ONE/ONE, so material.opacity is never consulted and
  // scaling there would silently do nothing.
  gl_FragColor = color * uIntensity;
}`;

/**
 * Anchor point and direction for each origin, in device pixels. Upstream's
 * table, unchanged — the 20% overshoot puts the source outside the frame so the
 * rays enter already fanned rather than starting from a visible hot point.
 */
const getAnchorAndDir = (
  origin: RaysOrigin,
  w: number,
  h: number,
): { anchor: [number, number]; dir: [number, number] } => {
  const outside = 0.2;
  switch (origin) {
    case "top-left":
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case "top-right":
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case "left":
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case "right":
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case "bottom-left":
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case "bottom-center":
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case "bottom-right":
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default:
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

const LightRays: FC<LightRaysProps> = ({
  raysOrigin = "top-center",
  raysColor = "#ffffff",
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0,
  distortion = 0,
  intensity = 1,
}) => {
  const mesh = useRef<Mesh>(null);
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });

  /*
    Pointer tracked on the WINDOW rather than through R3F's `state.pointer`.

    R3F derives its pointer from events on the canvas element, and this canvas
    is the hero's backdrop: it sits behind the scrim and all the copy, so it
    never receives a pointermove and `state.pointer` stays frozen at its
    initial value. `followMouse` was therefore doing nothing at all, which is
    most of why the rays looked static compared with the original — on the
    reference page the fan swings as the cursor moves.
  */
  const pointer = useRef({ x: 0.5, y: 0.5 });
  useEffect(() => {
    if (!followMouse) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX / window.innerWidth;
      // Shader space has +Y up; clientY is +Y down.
      pointer.current.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [followMouse]);

  // Built once and then mutated in useFrame. Rebuilding this object every
  // render would force three to re-upload every uniform each frame.
  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new Vector2(1, 1) },
      rayPos: { value: new Vector2(0, 0) },
      rayDir: { value: new Vector2(0, 1) },
      raysColor: { value: new Color(raysColor) },
      raysSpeed: { value: raysSpeed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1 : 0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      mousePos: { value: new Vector2(0.5, 0.5) },
      mouseInfluence: { value: mouseInfluence },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },
      uIntensity: { value: intensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  useFrame((_state, delta) => {
    // The shader works in DEVICE pixels — `iResolution.x` scales ray length and
    // fade distance, so feeding it CSS pixels would make the rays reach
    // noticeably shorter on a retina screen than on a standard one.
    uniforms.iResolution.value.set(size.width * dpr, size.height * dpr);

    uniforms.iTime.value += delta;

    /*
      The fan is ANCHORED. Position and direction come straight from the origin
      and do not move on their own.

      An earlier revision rotated this direction on a slow sine to add motion.
      That was the wrong reading of the effect: it swings the entire fan across
      the frame like a searchlight, which is not what light rays do and not what
      the reference does. All of the reference's movement happens INSIDE a fixed
      fan — see the shader's `baseStrength`, where two sin/cos terms over the
      ray angle scroll with `iTime`, so individual shafts brighten, dim and
      slide past each other while the cone itself stays put. Speed is the knob
      for that; direction is not.
    */
    const { anchor, dir } = getAnchorAndDir(raysOrigin, size.width * dpr, size.height * dpr);
    uniforms.rayPos.value.set(anchor[0], anchor[1]);
    uniforms.rayDir.value.set(dir[0], dir[1]);

    // Keep the live props in sync so tweaking them hot-reloads without a remount.
    uniforms.raysColor.value.set(raysColor);
    uniforms.raysSpeed.value = raysSpeed;
    uniforms.lightSpread.value = lightSpread;
    uniforms.rayLength.value = rayLength;
    uniforms.pulsating.value = pulsating ? 1 : 0;
    uniforms.fadeDistance.value = fadeDistance;
    uniforms.saturation.value = saturation;
    uniforms.mouseInfluence.value = followMouse ? mouseInfluence : 0;
    uniforms.noiseAmount.value = noiseAmount;
    uniforms.distortion.value = distortion;
    uniforms.uIntensity.value = intensity;

    if (followMouse && mouseInfluence > 0) {
      // Eased toward the pointer rather than snapped to it, so the fan glides
      // instead of jumping. Upstream's 0.92 is per-frame and therefore
      // framerate-dependent; this is the same feel expressed per-second.
      const k = 1 - Math.exp(-delta * 6);
      smoothMouse.current.x += (pointer.current.x - smoothMouse.current.x) * k;
      smoothMouse.current.y += (pointer.current.y - smoothMouse.current.y) * k;
      uniforms.mousePos.value.set(smoothMouse.current.x, smoothMouse.current.y);
    }
  });

  return (
    // renderOrder -1 draws this before the coins; with depth writes off it
    // cannot occlude them, so it stays a backdrop the geometry sits in front of.
    <ScreenQuad ref={mesh} renderOrder={-1}>
      <rawShaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        transparent
        /*
          Straight additive (ONE, ONE) rather than three's AdditiveBlending,
          which is (SRC_ALPHA, ONE). The shader puts the ray strength in the
          alpha channel as well as in rgb, so the stock preset would multiply
          strength by itself and crush the faint outer fan to nothing. Light
          adds; this is what adding looks like.
        */
        blending={CustomBlending}
        blendEquation={AddEquation}
        blendSrc={OneFactor}
        blendDst={OneFactor}
      />
    </ScreenQuad>
  );
};

export default LightRays;
