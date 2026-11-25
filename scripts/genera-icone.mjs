import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "public", "brand", "vale.png");
const out = path.join(root, "public", "icons");

async function render(size, name, paddingRatio) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const logo = await sharp(source)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(out, name));
}

await mkdir(out, { recursive: true });
await render(32, "favicon-32.png", 0.04);
await render(180, "apple-touch-icon.png", 0.08);
await render(192, "icon-192.png", 0.08);
await render(512, "icon-512.png", 0.08);
await render(512, "icon-maskable-512.png", 0.18);
await render(96, "badge-96.png", 0.12);
console.log("Icone generate in public/icons");
