/**
 * Converts a HEIC/HEIF file to JPEG on the client side.
 * If the file is not a HEIC file, it returns the original file.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  const fileName = file.name.toLowerCase();
  const isHeic = fileName.endsWith(".heic") || fileName.endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif";

  if (!isHeic) {
    return file;
  }

  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.8
    });
    
    // heic2any can return an array of blobs if the HEIC has multiple images
    const singleBlob = Array.isArray(blob) ? blob[0] : blob;
    
    // Preserve the original name but change extension
    const newName = file.name.replace(/\.heic$|\.heif$/i, '.jpg');
    return new File([singleBlob], newName, { type: "image/jpeg" });
  } catch (error) {
    console.error(`[HEIC Converter] Error converting ${file.name}:`, error);
    return file; // Fallback to original if conversion fails
  }
}
