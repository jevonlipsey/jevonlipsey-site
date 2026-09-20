import assert from 'node:assert/strict';
import test from 'node:test';
import { damp, tourYaw } from '../src/lib/hero-motion.ts';

test('gaze converges equally at 30, 60, and 144 hz', () => {
  const positions = [30, 60, 144].map((fps) => {
    let current = -0.4;
    for (let i = 0; i < fps / 2; i++) current = damp(current, 0.5, 1 / fps);
    return current;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-10);
});

test('deadband rests exactly and frozen gaze stays frozen', () => {
  assert.equal(damp(0.4999, 0.5, 1 / 60), 0.5);
  assert.equal(damp(0.4999, 0.5, 1 / 60, 0), 0.4999);
});

test('tour meets all phase boundaries without discontinuities', () => {
  assert.equal(tourYaw(0, 0.3), 0.3);
  assert.equal(tourYaw(1.8), Math.PI);
  assert.equal(tourYaw(3), Math.PI);
  assert.ok(Math.abs(tourYaw(5.9) + 0.2) < 1e-10);
  assert.equal(tourYaw(6.7), 0);
  for (const time of [1.8, 4.3, 5.9, 6.7]) {
    assert.ok(Math.abs(tourYaw(time - 0.0001) - tourYaw(time + 0.0001)) < 0.00001);
  }
});
