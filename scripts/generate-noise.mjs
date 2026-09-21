import { createCanvas } from 'canvas';
import fs from 'fs';

const size = 128;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

const imgData = ctx.createImageData(size, size);
const data = imgData.data;

for (let i = 0; i < data.length; i += 4) {
  // Generate monochromatic noise
  const val = Math.floor(Math.random() * 255);
  data[i] = val;     // R
  data[i + 1] = val; // G
  data[i + 2] = val; // B
  data[i + 3] = 40;  // Alpha (keep it mostly transparent to save bits)
}

ctx.putImageData(imgData, 0, 0);

const buffer = canvas.toBuffer('image/png');
const base64 = buffer.toString('base64');
console.log(`data:image/png;base64,${base64}`);
