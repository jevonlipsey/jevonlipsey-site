export function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}


export function damp(current: number, target: number, delta: number, rate = 9) {
  if (rate === 0) return current;
  const next = current + (target - current) * (1 - Math.exp(-rate * delta));
  return Math.abs(target - next) < 0.0005 ? target : next;
}


export function tourYaw(seconds: number, from = 0) {
  if (seconds >= 6.7) return 0;
  if (seconds < 1.8) return from + (Math.PI - from) * smoothstep(seconds / 1.8);
  if (seconds < 4.3) return Math.PI;
  if (seconds < 5.9) return Math.PI + (-0.2 - Math.PI) * smoothstep((seconds - 4.3) / 1.6);
  return -0.2 * (1 - smoothstep((seconds - 5.9) / 0.8));
}


export function springExplode(current: number, target: number, velocity: number, delta: number, stiffness = 110, damping = 12) {
  const force = -stiffness * (current - target);
  const dampForce = -damping * velocity;
  const nextVel = velocity + (force + dampForce) * delta;
  const nextPos = current + nextVel * delta;
  return { position: nextPos, velocity: nextVel };
}
