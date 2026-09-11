import sharp from 'sharp';

const MAX_DIMENSION = 2048;
const WEBP_QUALITY = 85;

/**
 * Optimizes an image for Cloudinary storage.
 * - Resizes to max 2048px on the longest side (preserves aspect ratio)
 * - Converts to WebP at quality 85 (visually lossless, ~70-80% smaller than camera JPEGs)
 * - Does NOT upscale images smaller than 2048px
 * 
 * Use the original (unoptimized) buffer for AI face detection to preserve accuracy.
 */
export async function optimizeForStorage(buffer: Buffer): Promise<{
  buffer: Buffer;
  width: number | null;
  height: number | null;
}> {
  const result = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}
