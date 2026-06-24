// Generates the Bill Mate SOURCE assets that @capacitor/assets consumes.
// Brand: indigo (#6366f1) -> violet (#8b5cf6) gradient with a white invoice mark
// (matches the gradients already used across the app's UI). Re-run any time you
// tweak the artwork:  node scripts/gen-brand-assets.mjs  &&  npm run assets:generate
//
// Output (assets/):
//   icon-background.png  1024x1024  Android adaptive-icon background (opaque gradient)
//   icon-foreground.png  1024x1024  Android adaptive-icon foreground (mark, transparent, in safe zone)
//   icon-only.png        1024x1024  iOS / fallback icon (opaque, full-bleed)
//   splash.png           2732x2732  Light launch screen (white bg + centered logo)
//   splash-dark.png      2732x2732  Dark launch screen (#0a0a0a bg + centered logo)

import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const INDIGO = "#6366f1"
const VIOLET = "#8b5cf6"

const gradientDef = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${INDIGO}"/><stop offset="1" stop-color="${VIOLET}"/>
</linearGradient></defs>`

// The white invoice mark, designed on a 1024 canvas, kept inside the Android
// "safe zone" (centre ~66%) so it is never clipped by adaptive-icon masks.
const mark = `
  <rect x="356" y="296" width="312" height="432" rx="36" fill="#ffffff"/>
  <rect x="404" y="392" width="216" height="32" rx="16" fill="${INDIGO}"/>
  <rect x="404" y="468" width="216" height="32" rx="16" fill="${VIOLET}"/>
  <rect x="404" y="544" width="140" height="32" rx="16" fill="${INDIGO}"/>`

const svgGradient = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${gradientDef}<rect width="1024" height="1024" fill="url(#g)"/></svg>`
const svgMark = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${mark}</svg>`
const svgTile = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${gradientDef}<rect width="1024" height="1024" rx="230" fill="url(#g)"/>${mark}</svg>`

const toPng = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()

await mkdir("assets", { recursive: true })

// Android adaptive layers
await sharp(Buffer.from(svgGradient)).png().toFile("assets/icon-background.png")
await sharp(Buffer.from(svgMark)).png().toFile("assets/icon-foreground.png")

// iOS / fallback full icon (opaque — App Store forbids transparency)
const grad = await toPng(svgGradient, 1024)
const markPng = await toPng(svgMark, 1024)
await sharp(grad).composite([{ input: markPng }]).png().toFile("assets/icon-only.png")

// Splash screens: small centred rounded logo tile on a solid background
const tile = await toPng(svgTile, 760)
const makeSplash = (bg, out) =>
  sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
    .composite([{ input: tile, gravity: "center" }])
    .png()
    .toFile(out)

await makeSplash("#ffffff", "assets/splash.png")
await makeSplash("#0a0a0a", "assets/splash-dark.png")

console.log("✓ Bill Mate source assets written to assets/")
