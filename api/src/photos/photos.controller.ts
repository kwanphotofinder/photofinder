import { Controller, Get, Post, Body, UseInterceptors, UploadedFile, BadRequestException, Delete, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhotosService } from './photos.service';
import { MetricsService } from '../metrics/metrics.service';
import { Prisma } from '@prisma/client';

@Controller('photos')
export class PhotosController {
    constructor(
        private readonly photosService: PhotosService,
        private readonly metricsService: MetricsService,
    ) { }

    @Post()
    create(@Body() data: Prisma.PhotoCreateInput) {
        return this.photosService.create(data);
    }

    @Get()
    findAll() {
        return this.photosService.findAll();
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadPhoto(
        @UploadedFile() file: Express.Multer.File,
        @Body('eventId') eventId: string,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!eventId) {
            throw new BadRequestException('Event ID is required');
        }

        try {
            const result = await this.photosService.uploadAndProcessPhoto(file, eventId);
            // Increment success counter
            this.metricsService.photoUploadsTotal.inc({ event_id: eventId, status: 'success' });
            return result;
        } catch (error) {
            // Increment failure counter
            this.metricsService.photoUploadsTotal.inc({ event_id: eventId, status: 'failed' });
            throw error;
        }
    }

    @Delete(':id')
    async deletePhoto(@Param('id') id: string) {
        return this.photosService.deletePhoto(id);
    }
}
