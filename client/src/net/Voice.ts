// Voice chat (PLAN.md Section 10): peer-to-peer WebRTC between the 3 browsers.
//
// - The Colyseus room relays the setup messages (`rtc` { to, data }).
// - For each pair of players, the one whose session id sorts lower makes the offer.
// - Push-to-talk on V by default: the mic track stays disabled until V is held.
//   Open mic is an option. M mutes either way.
// - Each remote voice: MediaStreamAudioSourceNode → per-player GainNode →
//   optional filter (700 Hz low-pass while jarred; walkie-talkie band-pass) →
//   the voice bus → speakers.
// - Speaking indicator: an AnalyserNode per stream; above 0.02 RMS for 100 ms
//   counts as speaking. No network message is needed for that.
// - No mic (denied or missing) is fine: you still hear everyone.

import type { Room } from "@colyseus/sdk";
import type { AudioBus } from "../audio/AudioBus";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAK_RMS = 0.02;
const SPEAK_ON_MS = 100;
const SPEAK_OFF_MS = 300;
const JAR_LOWPASS_HZ = 700;
/** The id the local player's own speaking indicator uses. */
export const LOCAL_PEER = "local";

type Signal =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit };

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  audio: HTMLAudioElement | null;
  source: MediaStreamAudioSourceNode | null;
  gain: GainNode;
  /** Jar muffle (low-pass) or walkie-talkie (band-pass), or passes straight through. */
  filter: BiquadFilterNode;
  walkie: WaveShaperNode;
  meter: Meter | null;
  pendingIce: RTCIceCandidateInit[];
  jarred: boolean;
}

/** Watches one stream's loudness to tell when someone is speaking. */
class Meter {
  private readonly analyser: AnalyserNode;
  private readonly data: Float32Array<ArrayBuffer>;
  private aboveSince = 0;
  private belowSince = 0;
  speaking = false;
  level = 0;

  constructor(ctx: AudioContext, source: AudioNode) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.data = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
  }

  /** Returns true when the speaking state changed. */
  sample(now: number): boolean {
    this.analyser.getFloatTimeDomainData(this.data);
    let sum = 0;
    for (const v of this.data) sum += v * v;
    this.level = Math.sqrt(sum / this.data.length);
    if (this.level > SPEAK_RMS) {
      this.belowSince = 0;
      this.aboveSince ||= now;
      if (!this.speaking && now - this.aboveSince >= SPEAK_ON_MS) { this.speaking = true; return true; }
    } else {
      this.aboveSince = 0;
      this.belowSince ||= now;
      if (this.speaking && now - this.belowSince >= SPEAK_OFF_MS) { this.speaking = false; return true; }
    }
    return false;
  }
}

export interface VoiceSettings {
  pushToTalk: boolean;
  walkie: boolean;
}

export class Voice {
  private room: Room | null = null;
  private myId = "";
  private local: MediaStream | null = null;
  private localMeter: Meter | null = null;
  private readonly peers = new Map<string, Peer>();
  private speakingCbs: Array<(peerId: string, on: boolean) => void> = [];
  private stateCbs: Array<() => void> = [];
  private ptt = false;
  private muted = false;
  private timer = 0;
  private offRtc: (() => void) | null = null;
  /** Why there is no mic: "" (fine), "denied", "missing" or "skipped". */
  micError = "";
  settings: VoiceSettings = { pushToTalk: true, walkie: false };

  constructor(private readonly bus: AudioBus) {}

  /** Start listening for signalling. The mic is asked for separately (askMic), after a click. */
  async init(room: Room, deviceId?: string): Promise<void> {
    this.room = room;
    this.myId = room.sessionId;
    this.offRtc = room.onMessage("rtc", (m: { from: string; data: Signal }) => void this.onSignal(m.from, m.data));
    this.timer = window.setInterval(() => this.sampleMeters(), 50);
    // Until a mic is on, others see a crossed-out mic.
    this.sendMicState();
    if (deviceId) await this.askMic(deviceId);
  }

  get hasMic(): boolean { return !!this.local; }
  get isMuted(): boolean { return this.muted; }
  get isTalking(): boolean { return this.trackEnabled(); }
  /** The local mic level, 0..~0.5, for the lobby's Test mic meter. */
  get micLevel(): number { return this.localMeter?.level ?? 0; }

  /** Ask for the microphone (from a click: browsers need a user gesture). */
  async askMic(deviceId?: string): Promise<boolean> {
    if (this.local) return true;
    await this.bus.unlock();
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(deviceId ? { deviceId } : {}) },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      this.micError = name === "NotFoundError" ? "missing" : "denied";
      this.sendMicState();
      this.changed();
      return false;
    }
    this.micError = "";
    this.localMeter = new Meter(this.bus.ctx, this.bus.ctx.createMediaStreamSource(this.local));
    this.applyTrackState();
    // Start sending on connections that already exist.
    const track = this.local.getAudioTracks()[0];
    for (const p of this.peers.values()) {
      const t = p.pc.getTransceivers().find((x) => x.receiver.track.kind === "audio");
      if (t) { void t.sender.replaceTrack(track); t.direction = "sendrecv"; }
    }
    this.sendMicState();
    this.changed();
    return true;
  }

  /** Never ask for the mic (?nomic=1). */
  skipMic(): void {
    this.micError = "skipped";
    this.sendMicState();
    this.changed();
  }

  /** Use a stream you made yourself instead of the microphone (testing with ?fakemic=1). */
  useStream(stream: MediaStream): void {
    this.local = stream;
    this.localMeter = new Meter(this.bus.ctx, this.bus.ctx.createMediaStreamSource(stream));
    this.applyTrackState();
    this.sendMicState();
    this.changed();
  }

  /** Make sure there is a connection to each of these players, and none to anyone else. */
  syncPeers(ids: readonly string[]): void {
    for (const id of ids) if (id !== this.myId && !this.peers.has(id)) this.connectTo(id);
    for (const id of [...this.peers.keys()]) if (!ids.includes(id)) this.closePeer(id);
  }

  /** Set up a connection. The lower session id sends the offer; the other waits for it. */
  connectTo(peerId: string): void {
    if (peerId === this.myId || this.peers.has(peerId)) return;
    const peer = this.makePeer(peerId);
    if (this.myId < peerId) void this.makeOffer(peer);
  }

  setPushToTalk(down: boolean): void {
    this.ptt = down;
    this.applyTrackState();
    this.changed();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyTrackState();
    this.sendMicState();
    this.changed();
  }

  setSettings(s: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.applyTrackState();
    for (const p of this.peers.values()) this.applyFilter(p);
    this.changed();
  }

  setPeerVolume(peerId: string, volume: number): void {
    const p = this.peers.get(peerId);
    p?.gain.gain.setTargetAtTime(volume, this.bus.ctx.currentTime, 0.05);
  }

  /** A jarred player sounds like they're stuck in a jar. */
  setPeerJarred(peerId: string, jarred: boolean): void {
    const p = this.peers.get(peerId);
    if (!p || p.jarred === jarred) return;
    p.jarred = jarred;
    this.applyFilter(p);
  }

  onSpeaking(cb: (peerId: string, on: boolean) => void): void {
    this.speakingCbs.push(cb);
  }

  /** Called when mic, mute or talking state changes (for the HUD). */
  onChange(cb: () => void): void {
    this.stateCbs.push(cb);
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.offRtc?.();
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    for (const t of this.local?.getTracks() ?? []) t.stop();
    this.local = null;
    this.speakingCbs = [];
    this.stateCbs = [];
  }

  // -------------------------------------------------------------------------

  private trackEnabled(): boolean {
    return !!this.local && !this.muted && (this.settings.pushToTalk ? this.ptt : true);
  }

  private applyTrackState(): void {
    const on = this.trackEnabled();
    for (const t of this.local?.getAudioTracks() ?? []) t.enabled = on;
  }

  private sendMicState(): void {
    this.room?.send("mic", { muted: this.muted || !this.local });
  }

  private changed(): void {
    for (const cb of this.stateCbs) cb();
  }

  private makePeer(id: string): Peer {
    const ctx = this.bus.ctx;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const walkie = ctx.createWaveShaper();
    walkie.curve = distortionCurve(8);
    gain.connect(filter);
    filter.connect(walkie);
    walkie.connect(this.bus.bus("voice"));
    const peer: Peer = { id, pc, audio: null, source: null, gain, filter, walkie, meter: null, pendingIce: [], jarred: false };
    this.applyFilter(peer);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(id, { type: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      // Chrome quirk: a remote WebRTC stream can stay silent in Web Audio
      // unless it's also attached to a muted <audio> element.
      const audio = new Audio();
      audio.srcObject = stream;
      audio.muted = true;
      void audio.play().catch(() => undefined);
      peer.audio = audio;
      peer.source?.disconnect();
      peer.source = ctx.createMediaStreamSource(stream);
      peer.source.connect(gain);
      peer.meter = new Meter(ctx, peer.source);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        // Try again from scratch (the lower id offers again).
        this.closePeer(id);
        this.connectTo(id);
      }
    };
    this.peers.set(id, peer);
    return peer;
  }

  private async makeOffer(peer: Peer): Promise<void> {
    const track = this.local?.getAudioTracks()[0];
    const t = peer.pc.addTransceiver("audio", { direction: "sendrecv" });
    if (track) await t.sender.replaceTrack(track);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.signal(peer.id, { type: "offer", sdp: offer.sdp ?? "" });
  }

  private async onSignal(from: string, data: Signal): Promise<void> {
    try {
      let peer = this.peers.get(from);
      if (data.type === "offer") {
        if (!peer) peer = this.makePeer(from);
        await peer.pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        // Send our mic on the transceiver the offer created.
        const track = this.local?.getAudioTracks()[0];
        const t = peer.pc.getTransceivers().find((x) => x.receiver.track.kind === "audio");
        if (t) { t.direction = "sendrecv"; if (track) await t.sender.replaceTrack(track); }
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.signal(from, { type: "answer", sdp: answer.sdp ?? "" });
        await this.flushIce(peer);
      } else if (data.type === "answer" && peer) {
        await peer.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        await this.flushIce(peer);
      } else if (data.type === "ice") {
        if (!peer) peer = this.makePeer(from);
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
        else peer.pendingIce.push(data.candidate);
      }
    } catch (err) {
      console.warn("voice signalling problem with", from, err);
    }
  }

  private async flushIce(peer: Peer): Promise<void> {
    for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => undefined);
  }

  private signal(to: string, data: Signal): void {
    this.room?.send("rtc", { to, data });
  }

  private applyFilter(p: Peer): void {
    if (p.jarred) {
      p.filter.type = "lowpass";
      p.filter.frequency.value = JAR_LOWPASS_HZ;
      p.filter.Q.value = 0.7;
    } else if (this.settings.walkie) {
      // Walkie-talkie: roughly 400–3000 Hz (a band-pass centred near 1.1 kHz).
      p.filter.type = "bandpass";
      p.filter.frequency.value = 1100;
      p.filter.Q.value = 0.5;
    } else {
      p.filter.type = "allpass";
    }
    p.walkie.curve = this.settings.walkie && !p.jarred ? distortionCurve(8) : null;
  }

  private sampleMeters(): void {
    const now = performance.now();
    if (this.localMeter && this.localMeter.sample(now)) this.emitSpeaking(LOCAL_PEER, this.localMeter.speaking && this.trackEnabled());
    for (const p of this.peers.values()) {
      if (p.meter?.sample(now)) this.emitSpeaking(p.id, p.meter.speaking);
    }
  }

  private emitSpeaking(id: string, on: boolean): void {
    for (const cb of this.speakingCbs) cb(id, on);
  }

  private closePeer(id: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.source?.disconnect();
    p.gain.disconnect();
    if (p.audio) p.audio.srcObject = null;
    this.peers.delete(id);
    this.emitSpeaking(id, false);
  }
}

/** A gentle distortion curve for the walkie-talkie filter. */
function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

const SETTINGS_KEY = "snikisnak.voice";

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { pushToTalk: true, walkie: false, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch { /* fine */ }
  return { pushToTalk: true, walkie: false };
}

export function saveVoiceSettings(s: VoiceSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* fine */ }
}
