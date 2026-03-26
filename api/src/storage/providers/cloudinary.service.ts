import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { StorageService } from '../storage.service';

@Injectable()
export class CloudinaryProviderService implements StorageService, OnModuleInit {
    private readonly logger = new Logger(CloudinaryProviderService.name);
    private readonly folderName = process.env.CLOUDINARY_FOLDER || 'photos';

    onModuleInit() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        // This is safe to run even if keys aren't set yet; it simply won't connect.
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            this.logger.warn('Cloudinary keys not detected. Ensure they are set in .env if using Cloudinary!');
        } else {
            this.logger.log('Cloudinary initialized as storage provider.');
        }
    }

    async uploadFile(fileName: string, fileBuffer: Buffer, contentType?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: this.folderName },
                (error, result) => {
                    if (error) {
                        this.logger.error(`Cloudinary upload failed: ${error.message}`);
                        return reject(error);
                    }
                    resolve(result?.secure_url || '');
                }
            );
            uploadStream.end(fileBuffer);
        });
    }

    async getFileUrl(objectName: string): Promise<string> {
        // Cloudinary URLs are naturally permanent and public unless strictly specified otherwise.
        return objectName;
    }

    async deleteFile(urlOrId: string): Promise<void> {
        try {
            // Find publicId inside the URL so delete works automatically if an old URL is passed
            let publicId = urlOrId;
            if (urlOrId.includes('cloudinary.com')) {
                const urlParts = urlOrId.split('/');
                const publicIdWithExtension = urlParts[urlParts.length - 1];
                const idWithoutExtension = publicIdWithExtension.split('.')[0];
                publicId = `${this.folderName}/${idWithoutExtension}`;
            }

            await cloudinary.uploader.destroy(publicId);
            this.logger.log(`Deleted file from Cloudinary: ${publicId}`);
        } catch (error) {
            this.logger.warn(`Failed to delete Cloudinary file: ${error.message}`);
        }
    }
}
