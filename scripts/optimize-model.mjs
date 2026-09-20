import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = 'public/models/jev_cyborg.glb';
const output = 'public/models/jev_cyborg.web.glb';
const temp = mkdtempSync(join(tmpdir(), 'portfolio-model-'));


function transform(...args) {
  execFileSync('npx', ['--yes', '@gltf-transform/cli@4.5.0', ...args], { stdio: 'inherit' });
}


function clipSignature(path) {
  const buffer = readFileSync(path);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
  return json.animations.map((animation) => ({
    name: animation.name,
    channels: animation.channels.map((channel) => `${json.nodes[channel.target.node].name}.${channel.target.path}`).sort(),
  })).sort((a, b) => a.name.localeCompare(b.name));
}


try {
  transform('resize', source, join(temp, 'resized.glb'), '--width', '2048', '--height', '2048');
  transform('webp', join(temp, 'resized.glb'), join(temp, 'textured.glb'), '--quality', '92');
  transform('meshopt', join(temp, 'textured.glb'), output, '--level', 'medium');
  if (JSON.stringify(clipSignature(source)) !== JSON.stringify(clipSignature(output))) {
    throw new Error('optimized animation channels differ from the source');
  }
  console.log(`verified ${clipSignature(output).length} synchronized animation clips`);
} finally {
  rmSync(temp, { recursive: true });
}
