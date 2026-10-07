const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create PNG buffer without external dependencies using pure Node.js and zlib
function createPng(width, height, drawFn) {
  // RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const color = drawFn(x, y, width, height);
      rgba[idx] = color[0];     // R
      rgba[idx + 1] = color[1]; // G
      rgba[idx + 2] = color[2]; // B
      rgba[idx + 3] = color[3]; // A
    }
  }

  // PNG filter byte (0 = None) per scanline
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (1 + width * 4);
    scanlines[scanlineOffset] = 0; // Filter: None
    rgba.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(scanlines);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcPayload = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcPayload), 0);
    return Buffer.concat([len, crcPayload, crc]);
  }

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Standard CRC32
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[i] = c;
}

// Icon Art: Campus Shield + Notification Bell in sleek Indigo/Cyan
function drawCampusIcon(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to 1
  const ny = (y / h) * 2 - 1; // -1 to 1
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Background: Rounded rectangle with gradient from #0f172a to #1e1b4b
  const cornerRadius = 0.75;
  const isInsideCard = (Math.abs(nx) < 0.9 && Math.abs(ny) < 0.9);
  
  // Base background gradient
  const bgGrad = (ny + 1) / 2;
  let r = Math.round(15 + bgGrad * 20);
  let g = Math.round(23 + bgGrad * 10);
  let b = Math.round(42 + bgGrad * 50);
  let a = 255;

  // Outer border glow
  if (dist > 0.82 && dist < 0.88) {
    r = 99; g = 102; b = 241; a = 220; // Indigo glow
  }

  // Draw Bell / Shield silhouette inside
  // Bell shape: top dome, flare body, clapper
  const bx = nx * 1.5;
  const by = ny * 1.5 + 0.1;

  // Bell body
  const inDome = (bx * bx + (by + 0.2) * (by + 0.2) < 0.16 && by < -0.1);
  const inWaist = (Math.abs(bx) < 0.4 + (by + 0.1) * 0.4 && by >= -0.2 && by <= 0.35);
  const inRim = (Math.abs(bx) < 0.55 && by > 0.3 && by < 0.42);
  const inClapper = (bx * bx + (by - 0.48) * (by - 0.48) < 0.02);
  const inTopRing = (bx * bx + (by + 0.45) * (by + 0.45) < 0.025);

  if (inDome || inWaist || inRim || inClapper || inTopRing) {
    // Gradient for Bell: Vibrant Cyan to Amber badge
    const bellGrad = (by + 0.5);
    r = Math.round(56 + bellGrad * 180);
    g = Math.round(189 - bellGrad * 40);
    b = Math.round(248 - bellGrad * 100);
    a = 255;
  }

  // Small emergency notification alert dot at top-right
  const dotX = nx - 0.38;
  const dotY = ny + 0.38;
  if (dotX * dotX + dotY * dotY < 0.02) {
    r = 239; g = 68; b = 68; a = 255; // Red dot alert
  }

  return [r, g, b, a];
}

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'badge.png', size: 96 }
];

sizes.forEach(({ name, size }) => {
  const filePath = path.join(iconsDir, name);
  const buf = createPng(size, size, drawCampusIcon);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated ${name} (${size}x${size})`);
});

// Also create an SVG version for high-res crisp display
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e0e7ff" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#6366f1" flood-opacity="0.45" />
    </filter>
  </defs>
  
  <!-- App Background -->
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  <rect x="12" y="12" width="488" height="488" rx="100" fill="none" stroke="#38bdf8" stroke-opacity="0.25" stroke-width="3" />
  
  <!-- Outer Shield -->
  <path d="M256 64 L396 116 V248 C396 348 256 428 256 428 C256 428 116 348 116 248 V116 Z" 
        fill="url(#shieldGrad)" opacity="0.18" />
  <path d="M256 74 L386 122 V244 C386 338 256 414 256 414 C256 414 126 338 126 244 V122 Z" 
        fill="none" stroke="url(#shieldGrad)" stroke-width="6" filter="url(#glow)" />
        
  <!-- Campus Bell Icon inside Shield -->
  <!-- Bell Ring -->
  <circle cx="256" cy="180" r="14" fill="none" stroke="url(#bellGrad)" stroke-width="8" />
  <!-- Bell Body -->
  <path d="M256 195 C220 195 200 230 195 285 C190 325 170 338 165 345 H347 C342 338 322 325 317 285 C312 230 292 195 256 195 Z" 
        fill="url(#bellGrad)" />
  <!-- Bell Clapper -->
  <path d="M232 355 C232 368 243 379 256 379 C269 379 280 368 280 355 Z" fill="#38bdf8" />
  
  <!-- Live Signal Waves -->
  <path d="M150 220 A 130 130 0 0 0 130 300" fill="none" stroke="#38bdf8" stroke-width="7" stroke-linecap="round" opacity="0.8" />
  <path d="M362 220 A 130 130 0 0 1 382 300" fill="none" stroke="#38bdf8" stroke-width="7" stroke-linecap="round" opacity="0.8" />

  <!-- Security Check / Alert Badge -->
  <circle cx="360" cy="150" r="28" fill="#ef4444" stroke="#ffffff" stroke-width="5" />
  <circle cx="360" cy="150" r="10" fill="#ffffff" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');
console.log('Generated icon.svg successfully');
