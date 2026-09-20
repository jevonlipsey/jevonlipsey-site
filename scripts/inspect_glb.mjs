import fs from 'node:fs';

const buf = fs.readFileSync('public/models/jev_cyborg.glb');
const magic = buf.toString('ascii', 0, 4);
const version = buf.readUInt32LE(4);
let off = 12;
const jsonChunkLen = buf.readUInt32LE(off); off += 4;
const jsonType = buf.toString('ascii', off, off + 4); off += 4;
if (jsonType !== 'JSON') throw new Error('expected a json chunk');
const json = JSON.parse(buf.toString('utf8', off, off + jsonChunkLen));
console.log('magic', magic, 'version', version, 'jsonLen', jsonChunkLen);

const anims = json.animations || [];
console.log('num animations:', anims.length);

for (const a of anims) {
  const name = a.name || '(unnamed)';
  const targets = [];
  for (const ch of a.channels) {
    const node = json.nodes[ch.target.node];
    targets.push((node && node.name) + '.' + ch.target.path);
  }
  console.log('--- animation', JSON.stringify(name), 'channels:', a.channels.length, 'targets:', targets.join(', '));
  for (const s of a.samplers) {
    const inp = json.accessors[s.input];
    if (inp.max) console.log('   sampler input max:', inp.max);
  }
}

const nodes = json.nodes || [];
console.log('total nodes:', nodes.length);
const interesting = nodes
  .map((n) => n && n.name)
  .filter((n) => n && /eye|head|plane|sphere/i.test(n));
console.log('interesting node names:', interesting.join(', '));
