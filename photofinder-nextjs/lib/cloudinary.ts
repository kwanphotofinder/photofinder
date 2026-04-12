import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using the CLOUDINARY_URL environment variable
cloudinary.config({
  secure: true, // Use HTTPS
});

/**
 * Uploads a file buffer directly to Cloudinary.
 * @param fileName the original filename
 * @param mimeType the mimetype of the image
 * @param fileBuffer the file data
 * @returns the secure URL of the uploaded image on Cloudinary
 */
export async function uploadToCloudinary(fileName: string, mimeType: string, fileBuffer: Buffer, eventId?: string): Promise<string> {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error('CLOUDINARY_URL environment variable is missing.');
  }

  // Use a specific folder for events to make bulk deletion easy, or fallback to the root photofinder folder
  const folderPath = eventId ? `photofinder/${eventId}` : 'photofinder';

  return new Promise((resolve, reject) => {
    // Cloudinary's upload stream accepts a buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath, 
        resource_type: 'auto', // Automatically detect whether it's an image or video
        // Sanitize filename: replace spaces & special chars with underscores to prevent URL-encoding mismatches during deletion
        public_id: `${fileName.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          reject(error);
        } else if (result) {
          // result.secure_url is the https:// link to your image!
          resolve(result.secure_url);
        } else {
          reject(new Error('Unknown upload error.'));
        }
      }
    );

    // End the stream with the buffer
    uploadStream.end(fileBuffer);
  });
}

/**
 * Deletes an entire folder from Cloudinary
 * Useful for bulk deleting an expired event's photos
 */
export async function deleteFolderFromCloudinary(eventId: string) {
  if (!process.env.CLOUDINARY_URL || !eventId) return;
  try {
    const folderPath = `photofinder/${eventId}`;
    
    // Cloudinary requires deleting all resources in a folder before the folder itself can be deleted.
    // delete_resources_by_prefix handles the files
    await cloudinary.api.delete_resources_by_prefix(folderPath);
    // delete_folder removes the empty directory
    await cloudinary.api.delete_folder(folderPath);
    
    console.log(`Deleted Cloudinary folder: ${folderPath}`);
  } catch (error) {
    console.error(`Error deleting Cloudinary folder ${eventId}:`, error);
  }
}

/**
 * Deletes a file from Cloudinary given its secure URL.
 */
export async function deleteFromCloudinary(url: string) {
  if (!process.env.CLOUDINARY_URL || !url) return;
  try {
    // Cloudinary URLs look like this:
    // https://res.cloudinary.com/cloudname/image/upload/v1234567/photofinder/filename.ext
    
    // 1. Split by /upload/
    const parts = url.split('/upload/');
    if (parts.length !== 2) return;
    
    // 2. Remove the version string (e.g., v1234567/) if it exists
    let endPath = parts[1];
    // Decode URL-encoded characters (e.g., %20 -> space) so the public_id matches what Cloudinary stored
    endPath = decodeURIComponent(endPath);
    if (endPath.match(/^v\d+\//)) {
      endPath = endPath.replace(/^v\d+\//, '');
    }
    
    // 3. Remove the file extension if it exists to get the true public_id
    // Example: photofinder/filename.webp -> photofinder/filename
    const lastDotIndex = endPath.lastIndexOf('.');
    const publicId = lastDotIndex !== -1 ? endPath.substring(0, lastDotIndex) : endPath;
    
    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
      console.log(`Cloudinary destroy result for ${publicId}:`, result);
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
}
