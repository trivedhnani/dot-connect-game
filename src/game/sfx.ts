// synthesized UI sound; no assets. Volumes stay whisper-quiet (≤ −18dB).
import { getSound } from './settings'

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}
export function noteFreq(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12)
}
function blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
  if (!getSound()) return
  const a = ac(); if (!a) return
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(vol, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g).connect(a.destination)
  o.start(); o.stop(a.currentTime + dur + 0.02)
}
export const sfx = {
  tick: (i: number) => blip(noteFreq(392, i), 0.08, 'sine', 0.05),
  tickDown: (i: number) => blip(noteFreq(392, i), 0.07, 'sine', 0.04),
  pip: () => blip(988, 0.1, 'sine', 0.055),
  clunk: () => { blip(130, 0.16, 'triangle', 0.11); blip(98, 0.2, 'sine', 0.08) },
  sealTick: () => blip(220, 0.1, 'square', 0.03),
  thud: () => blip(90, 0.22, 'triangle', 0.12),
  chord: () => [523.25, 659.25, 784].forEach((f, i) => setTimeout(() => blip(f, 0.5, 'sine', 0.05), i * 70)),
  brush: () => { blip(300, 0.2, 'sine', 0.05); blip(200, 0.25, 'sine', 0.04) },
}
