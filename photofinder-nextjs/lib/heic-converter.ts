import heic2any from "heic2any";

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
    console.log(`[HEIC Converter] Converting ${file.name} to JPEG...`);
    
    // heic2any is a browser-only library
    if (typeof window === "undefined") return file;

    const convertedBlob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.85,
    });

    // heic2any can return an array if multiple images are in the HEIF container
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    const newFileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    
    const convertedFile = new File([blob], newFileName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    console.log(`[HEIC Converter] Conversion successful: ${convertedFile.name} (${Math.round(convertedFile.size / 1024)} KB)`);
    return convertedFile;
  } catch (error) {
    console.error("[HEIC Converter] Failed to convert HEIC:", error);
    return file; // Fallback to original file (backend will still fail, but we don't break the UI flow)
  }
}
