/**
 * Client-side gallery image reader & optimizer.
 * Accepts raster images from device gallery (PNG, JPEG, WebP, GIF),
 * rejects SVG to prevent script payloads, and downscales large camera photos
 * so uploads are fast and lightweight.
 */

const ALLOWED_RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

export interface ImageUploadOptions {
  maxDimension?: number;
  quality?: number;
  maxRawBytes?: number;
  maxOutputBytes?: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ছবি পড়া যায়নি।'));
      }
    };
    reader.onerror = () => reject(new Error('ফাইলটি লোড করা যায়নি।'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ছবিটি প্রসেস করা যায়নি।'));
    img.src = src;
  });
}

export async function processGalleryImageFile(
  file: File,
  options: ImageUploadOptions = {}
): Promise<string> {
  const {
    maxDimension = 1280,
    quality = 0.82,
    maxRawBytes = 12 * 1024 * 1024,
    maxOutputBytes = 900 * 1024,
  } = options;

  if (!ALLOWED_RASTER_TYPES.has(file.type)) {
    throw new Error('শুধু PNG, JPG, WebP বা GIF ছবি গ্যালারি থেকে আপলোড করা যাবে।');
  }
  if (file.size > maxRawBytes) {
    throw new Error('ছবির আকার ১২ মেগাবাইটের কম হতে হবে।');
  }

  const rawDataUrl = await readAsDataUrl(file);

  // Preserve animated GIFs directly if already under output limit
  if (file.type === 'image/gif' && rawDataUrl.length <= maxOutputBytes) {
    return rawDataUrl;
  }

  const img = await loadImageElement(rawDataUrl);
  const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
  const targetW = Math.max(1, Math.round((img.width || 1) * scale));
  const targetH = Math.max(1, Math.round((img.height || 1) * scale));

  // If image is already compact and smaller than maxDimension, keep it cleanly
  if (scale === 1 && rawDataUrl.length <= 350 * 1024) {
    return rawDataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (rawDataUrl.length <= maxOutputBytes) return rawDataUrl;
    throw new Error('ব্রাউজার ছবি রিসাইজ করতে পারেনি।');
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Use PNG for transparent PNGs when small, otherwise JPEG for compact upload
  const outputMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  let result = canvas.toDataURL(outputMime, quality);

  // Fallback to JPEG if browser returned PNG or oversized output
  if (result.length > maxOutputBytes) {
    result = canvas.toDataURL('image/jpeg', 0.72);
  }
  if (result.length > maxOutputBytes) {
    result = canvas.toDataURL('image/jpeg', 0.56);
  }

  if (result.length > maxOutputBytes) {
    throw new Error('ছবিটি অনেক বড় — অনুগ্রহ করে তুলনামূলক ছোট ছবি নির্বাচন করুন।');
  }

  return result;
}
