# asset source + pack flow

keep design sources here; they never ship. the model packs into `public/models/`.

## model pipeline

- source: `jev_cyborg.glb` (blender export)
- shipped: `public/models/jev_cyborg.web.glb`

to update the bust: replace `jev_cyborg.glb`, then run

```sh
npm run optimize:model
```

the script: `resize textures to 2048` → `webp q92` → `meshopt level medium`, then it
verifies every animation channel still matches the source clip-for-clip.

notes:
- `-m` style mesh-merge is OFF: each articulated part carries its own clip, so
  merging would break the animation.
- vertex quantization was tested and rejected (made output bigger — meshopt
  already bit-packs the vertex streams tightly). texture resolution is the real
  lever if the close-up can tolerate 1024px.
- `scripts/inspect_glb.mjs` prints skeleton + clip windows for debugging.

## image pipeline

- `npm run og:generate` -> renders `public/og.png` (1200x630 vector card) from
  `scripts/generate-og.ts`
- `scripts/optimize-images.mjs` -> one-off webp re-encode for page images