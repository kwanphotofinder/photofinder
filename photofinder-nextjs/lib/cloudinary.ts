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
        public_id: `${fileName.split('.')[0]}_${Date.now()}`, // Make it unique to prevent overwriting/accidental deletion of shared filenames
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
    if (endPath.match(/^v\d+\//)) {
      endPath = endPath.replace(/^v\d+\//, '');
    }
    
    // 3. Remove the file extension (e.g., .jpg) to get the true public_id
    // Example: photofinder/filename.jpg -> photofinder/filename
    const publicId = endPath.split('.').slice(0, -1).join('.');
    
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
      console.log(`Deleted from Cloudinary: ${publicId}`);
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
}
