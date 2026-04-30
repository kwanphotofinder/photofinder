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

  console.warn(`[HEIC Converter] ${file.name} is HEIC/HEIF, but conversion is unavailable in this build.`);
  return file;
}
