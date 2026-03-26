import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class StorageService {
    abstract uploadFile(
        fileName: string,
        fileBuffer: Buffer,
        contentType: string,
    ): Promise<string>;

    abstract getFileUrl(objectName: string): Promise<string>;

    abstract deleteFile(objectName: string): Promise<void>;
}
