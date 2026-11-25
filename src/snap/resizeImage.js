// Shrinks a photo on the phone before it is sent: longest side 1280 px, JPEG
// at quality 0.8. Drawing through a canvas also drops location and camera data
// (EXIF), and turns iPhone HEIC photos into JPEG where the browser can open
// them. The photo never leaves memory except in the one /api/snap request.

export const MAX_SIDE = 1280;
export const QUALITY = 0.8;
export const MAX_BYTES = 1.5 * 1024 * 1024;

// The size to draw at: never larger than the original, longest side <= max.
export function fitWithin(width, height, max = MAX_SIDE) {
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));

  if (w === 0 || h === 0) return { width: 0, height: 0 };

  const scale = Math.min(1, max / Math.max(w, h));

  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

// Bytes in a base64 string (without the data: prefix).
export function base64Bytes(base64) {
  const text = String(base64 || '');
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;

  return Math.max(0, Math.floor((text.length * 3) / 4) - padding);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

// -> { base64, bytes, width, height, dataUrl }. Throws Error('unreadable') or
// Error('too_big').
export async function resizeImage(file, { max = MAX_SIDE, quality = QUALITY } = {}) {
  const img = await loadImage(file);
  const size = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, max);

  if (!size.width) throw new Error('unreadable');

  const canvas = document.createElement('canvas');

  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d').drawImage(img, 0, 0, size.width, size.height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = base64Bytes(base64);

  if (bytes > MAX_BYTES) throw new Error('too_big');

  return { base64, bytes, ...size, dataUrl };
}
