import fs from 'node:fs';

const buf = fs.readFileSync('public/models/jev_cyborg.glb');
let off = 12;
const jsonChunkLen = buf.readUInt32LE(off); off += 4;
off += 4;
const json = JSON.parse(buf.toString('utf8', off, off + jsonChunkLen));

function nodeMatrix(n, parent) {
  // translation
  const t = n.translation || [0, 0, 0];
  const r = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  // build matrix via helper functions

  const quat = [r[0], r[1], r[2], r[3]];
  const scale = [s[0], s[1], s[2]];
  // translate * rotate * scale
  let out = [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ];
  out = n.matrix || mult(mult(translate(t), quatToMat(quat)), scaleMat(scale));

  if (parent) {
    out = mult(parent, out);
  }
  return out;
}

function quatToMat(q) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

function translate(t) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
}

function scaleMat(s) {
  return [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
}

function mult(a, b) {
  // a * b, column-major
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) {
        v += a[k * 4 + r] * b[c * 4 + k];
      }
      out[c * 4 + r] = v;
    }
  }
  return out;
}

function transformPoint(p, m) {
  const [x, y, z] = p;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

// map node children
const childrenOf = {};
for (let i = 0; i < json.nodes.length; i++) {
  const n = json.nodes[i];
  if (n.children) {
    for (const ch of n.children) childrenOf[ch] = i;
  }
}

const matrices = new Array(json.nodes.length).fill(null);
function matrixFor(i) {
  if (matrices[i]) return matrices[i];
  const n = json.nodes[i];
  const parent = childrenOf[i] !== undefined ? matrixFor(childrenOf[i]) : null;
  matrices[i] = nodeMatrix(n, parent);
  return matrices[i];
}

const results = [];
for (let i = 0; i < json.nodes.length; i++) {
  const n = json.nodes[i];
  if (!n.mesh) continue;
  const prim = json.meshes[n.mesh].primitives[0];
  if (!prim.attributes.POSITION) continue;
  const posAcc = json.accessors[prim.attributes.POSITION];
  if (!posAcc.min || !posAcc.max) continue;
  const m = matrixFor(i);
  const maxX = json.accessors.length; // placeholder to silence unused warn
  const mins = transformPoint(posAcc.min, m);
  const maxs = transformPoint(posAcc.max, m);
  results.push({
    name: n.name,
    minY: mins[1],
    maxY: maxs[1],
    maxX,
  });
}

results.sort((a, b) => a.minY - b.minY);
console.log('lowest 12 meshes by minY:');
for (const r of results.slice(0, 12)) {
  console.log('  y:', r.minY.toFixed(3), '->', r.maxY.toFixed(3), r.name);
}
console.log('all mesh count:', results.length);
