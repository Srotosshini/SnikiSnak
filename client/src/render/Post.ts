// Post-processing (PLAN.md Section 11, "Post-processing"), in order:
//   RenderPass → tilt-shift (two blur passes, sharp band across the middle 40%
//   of the screen, blur growing toward the top and bottom) → UnrealBloomPass
//   (strength 0.35, radius 0.4, threshold 0.85, so only lamps and eyes glow) →
//   colour grade (shadows lifted toward midnight blue, highlights warmed,
//   saturation 0.95) → vignette 0.35 and animated film grain 0.04 → OutputPass.
// Low graphics turns this off (and shadows) and renders directly.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { PALETTE } from "./palette";

/** One direction of the tilt-shift blur: none in the middle band, more toward the edges. */
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    direction: { value: new THREE.Vector2(1, 0) },
    resolution: { value: new THREE.Vector2(1, 1) },
    band: { value: 0.2 },        // half-height of the sharp band (40% total)
    strength: { value: 3.0 },    // blur radius in pixels at the screen edge
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 direction;
    uniform vec2 resolution;
    uniform float band;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - 0.5) - band) / (0.5 - band);
      float r = d * d * strength;
      if (r < 0.01) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 step = direction * r / resolution;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
      sum += texture2D(tDiffuse, vUv + step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + step * 3.2307692308) * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - step * 3.2307692308) * 0.0702702703;
      gl_FragColor = sum;
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    shadowTint: { value: new THREE.Color(PALETTE.midnight) },
    highlightTint: { value: new THREE.Color(PALETTE.lamp) },
    saturation: { value: 0.95 },
    vignette: { value: 0.35 },
    grain: { value: 0.04 },
    time: { value: 0 },
  },
  vertexShader: TiltShiftShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 shadowTint;
    uniform vec3 highlightTint;
    uniform float saturation;
    uniform float vignette;
    uniform float grain;
    uniform float time;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // Lift shadows toward midnight blue, warm the highlights a little.
      c = mix(c, c + shadowTint * 0.35, (1.0 - smoothstep(0.0, 0.45, l)) * 0.5);
      c = mix(c, c * (0.85 + highlightTint * 0.25), smoothstep(0.55, 1.0, l) * 0.6);
      c = mix(vec3(l), c, saturation);
      // Vignette.
      vec2 p = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.75, length(p) * 1.25);
      // Animated film grain.
      c += (rand(vUv * 1000.0 + time) - 0.5) * grain;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export class Post {
  private readonly composer: EffectComposer;
  private readonly tiltX: ShaderPass;
  private readonly tiltY: ShaderPass;
  private readonly grade: ShaderPass;
  private readonly bloom: UnrealBloomPass;
  private t = 0;
  /** Off when Low graphics is on. */
  enabled = true;

  constructor(private readonly renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.tiltX = new ShaderPass(TiltShiftShader);
    this.tiltY = new ShaderPass(TiltShiftShader);
    this.tiltY.uniforms.direction.value = new THREE.Vector2(0, 1);
    this.composer.addPass(this.tiltX);
    this.composer.addPass(this.tiltY);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.85);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /** Turn the tilt-shift blur up or down (the briefing looks straight down, so less blur). */
  setTiltStrength(px: number): void {
    this.tiltX.uniforms.strength.value = px;
    this.tiltY.uniforms.strength.value = px;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    for (const p of [this.tiltX, this.tiltY]) p.uniforms.resolution.value.set(w * pr, h * pr);
  }

  render(dt: number): void {
    this.t += dt;
    this.grade.uniforms.time.value = this.t % 100;
    this.composer.render(dt);
  }
}
