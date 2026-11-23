// The Three.js renderer and an (almost) empty scene. Phase 1 fills it with
// the diorama camera, the level and the characters (PLAN.md Section 11).

import * as THREE from "three";

const MIDNIGHT = 0x1d2340; // palette: ambient light, deep shadow

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  private readonly timer = new THREE.Timer();
  private readonly onFrame: Array<(dt: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(MIDNIGHT);
    this.camera.position.set(0, 10, 7);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0x6f86c9, 0x2a2233, 0.6));

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  /** Register something to update every frame. */
  addFrameCallback(cb: (dt: number) => void): void {
    this.onFrame.push(cb);
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(time: number): void {
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    for (const cb of this.onFrame) cb(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
