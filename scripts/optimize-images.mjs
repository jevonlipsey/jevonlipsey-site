import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function optimizeImages() {
  const mePath = path.join(process.cwd(), 'public', 'me.png');
  const profPath = path.join(process.cwd(), 'public', 'professional pic.JPG');
  const ogPath = path.join(process.cwd(), 'public', 'og.png');

  if (fs.existsSync(mePath)) {
    console.log('Optimizing me.png...');
    await sharp(mePath)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(process.cwd(), 'public', 'me.webp'));
    fs.unlinkSync(mePath);
    console.log('Done me.webp');
  }

  if (fs.existsSync(profPath)) {
    console.log('Optimizing professional pic.JPG...');
    await sharp(profPath)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(process.cwd(), 'public', 'professional-pic.webp'));
    fs.unlinkSync(profPath);
    console.log('Done professional-pic.webp');
  }

  if (fs.existsSync(ogPath)) {
    console.log('Optimizing og.png...');
    // We leave og.png as png because open graph expects standard formats (png/jpg).
    // Let's just compress it slightly.
    const buffer = await sharp(ogPath)
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(ogPath, buffer);
    console.log('Done og.png compression');
  }
}

optimizeImages().catch(console.error);
