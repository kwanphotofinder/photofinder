import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { MinioProviderService } from './providers/minio.service';
import { CloudinaryProviderService } from './providers/cloudinary.service';

@Module({
  providers: [
    {
      provide: StorageService,
      useClass: process.env.STORAGE_PROVIDER === 'cloudinary' 
        ? CloudinaryProviderService 
        : MinioProviderService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
