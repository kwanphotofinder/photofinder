import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PhotosService } from '../photos/photos.service';

@Injectable()
export class EventsService {
    constructor(
        private prisma: PrismaService,
        private photosService: PhotosService,
    ) { }

    create(data: Prisma.EventCreateInput) {
        return this.prisma.event.create({ data });
    }

    findAll() {
        return this.prisma.event.findMany();
    }

    findOne(id: string) {
        return this.prisma.event.findUnique({ where: { id } });
    }

    update(id: string, data: Prisma.EventUpdateInput) {
        return this.prisma.event.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        // 1. Find all photos for this event
        const photos = await this.prisma.photo.findMany({
            where: { eventId: id },
        });

        // 2. Delete each photo (this handles MinIO and Weaviate cleanup)
        for (const photo of photos) {
            await this.photosService.deletePhoto(photo.id);
        }

        // 3. Delete the event
        return this.prisma.event.delete({ where: { id } });
    }
}
