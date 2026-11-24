// The Three.js renderer and the diorama camera (PLAN.md Section 11, "Camera and scale").
//
// Camera: perspective, 28° field of view, looking down at about 55° from the
// south. It frames the whole room with a margin, and drifts gently toward the
// local player: target = room centre blended 25% toward the player.
// Screens like the rooftop can take the camera over with setManualCamera().
// Post-processing runs unless Low graphics is on (which also turns off shadows).

import * as THREE from "three";
import { PALETTE } from "./palette";
import { Post } from "./Post";

const FOV = 28;
const PITCH = THREE.MathUtils.degToRad(55);
/** The briefing camera rises to look almost straight down. */
const TOP_DOWN_PITCH = THREE.MathUtils.degToRad(78);
/** Tiles of margin around the room (1 tile, plus a little for the drift). */
const MARGIN = 1.4;
const DRIFT = 0.25;
/** How quickly the camera catches up with its target (1/seconds). */
const FOLLOW_RATE = 3;
const WALL_HEIGHT = 3;
const MIN_ZOOM = 0.25;

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
  private readonly timer = new THREE.Timer();
  private readonly onFrame: Array<(dt: number) => void> = [];

  private room = { width: 10, depth: 10 };
  private distance = 20;
  /** 1 = the whole room fits; smaller is closer (dev zoom only). */
  private zoom = 1;
  private pitch = PITCH;
  private targetPitch = PITCH;
  private readonly lookTarget = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly post: Post;
  private lowGraphics = false;
  private manual: ((camera: THREE.PerspectiveCamera, dt: number) => void) | null = null;
  /** Frames per second, measured over the last half second. */
  fps = 60;
  private fpsFrames = 0;
  private fpsTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(PALETTE.midnight);
    this.post = new Post(this.renderer, this.scene, this.camera);

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  /** Register something to update every frame. Returns a function that removes it. */
  addFrameCallback(cb: (dt: number) => void): () => void {
    this.onFrame.push(cb);
    return () => {
      const i = this.onFrame.indexOf(cb);
      if (i >= 0) this.onFrame.splice(i, 1);
    };
  }

  /** Frame a room of this many tiles. */
  frameRoom(width: number, depth: number): void {
    this.room = { width, depth };
    this.fitDistance();
    this.desiredTarget.set(width / 2, 0, depth / 2);
    this.lookTarget.copy(this.desiredTarget);
    this.placeCamera();
  }

  /** Drift toward the local player (pass null to centre on the room). */
  follow(x: number | null, z: number | null): void {
    const cx = this.room.width / 2, cz = this.room.depth / 2;
    // Zoomed in (dev only), the camera follows the player more closely.
    const drift = DRIFT + (1 - DRIFT) * (1 - this.zoom) / (1 - MIN_ZOOM);
    if (x === null || z === null) this.desiredTarget.set(cx, 0, cz);
    else this.desiredTarget.set(cx + (x - cx) * drift, 0, cz + (z - cz) * drift);
  }

  /** Low graphics (Section 11): no tilt-shift, bloom or shadows, and a pixel ratio of 1. */
  setLowGraphics(low: boolean): void {
    if (low === this.lowGraphics) return;
    this.lowGraphics = low;
    this.post.enabled = !low;
    this.renderer.shadowMap.enabled = !low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    // Materials must recompile when shadows are switched.
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true;
    });
    this.resize();
  }

  /** Let a screen (the rooftop, the cutscene) move the camera itself; null gives it back. */
  setManualCamera(fn: ((camera: THREE.PerspectiveCamera, dt: number) => void) | null): void {
    this.manual = fn;
    if (!fn) {
      this.camera.fov = FOV;
      this.camera.updateProjectionMatrix();
    }
  }

  /** How many draw calls the last frame took (Section 16: keep under 300). */
  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  /** Briefing view: look almost straight down at the whole room. */
  setTopDown(on: boolean): void {
    this.targetPitch = on ? TOP_DOWN_PITCH : PITCH;
  }

  /** Dev mode: let the mouse wheel zoom in for a closer look. */
  enableDevZoom(): void {
    window.addEventListener("wheel", (e) => {
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(e.deltaY * 0.001), MIN_ZOOM, 1);
    }, { passive: true });
  }

  /** Find the smallest camera distance that keeps the whole room (plus margin) on screen. */
  private fitDistance(): void {
    const { width, depth } = this.room;
    const corners: THREE.Vector3[] = [];
    for (const x of [-MARGIN, width + MARGIN]) {
      for (const z of [-MARGIN, depth + MARGIN]) {
        for (const y of [0, WALL_HEIGHT]) corners.push(new THREE.Vector3(x, y, z));
      }
    }
    const centre = new THREE.Vector3(width / 2, 0, depth / 2);
    const fits = (d: number): boolean => {
      this.camera.position.set(centre.x, centre.y + Math.sin(this.pitch) * d, centre.z + Math.cos(this.pitch) * d);
      this.camera.lookAt(centre);
      this.camera.updateMatrixWorld();
      return corners.every((c) => {
        const p = c.clone().project(this.camera);
        return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1;
      });
    };
    let lo = 1, hi = 400;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    this.distance = hi;
  }

  private placeCamera(): void {
    const t = this.lookTarget;
    const d = this.distance * this.zoom;
    this.camera.position.set(t.x, t.y + Math.sin(this.pitch) * d, t.z + Math.cos(this.pitch) * d);
    this.camera.lookAt(t);
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitDistance();
    this.placeCamera();
  }

  private frame(time: number): void {
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsTime); this.fpsFrames = 0; this.fpsTime = 0; }
    for (const cb of this.onFrame) cb(dt);
    if (this.manual) {
      this.manual(this.camera, dt);
    } else {
      if (Math.abs(this.pitch - this.targetPitch) > 1e-4) {
        this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 3);
        this.fitDistance();
      }
      this.lookTarget.lerp(this.desiredTarget, 1 - Math.exp(-FOLLOW_RATE * dt));
      this.placeCamera();
    }
    // Less tilt-shift blur when looking straight down in the briefing.
    this.post.setTiltStrength(this.targetPitch === PITCH || this.manual ? 3 : 1);
    if (this.post.enabled) this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
