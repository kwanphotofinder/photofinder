import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [
        PrismaModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    controllers: [AdminController],
})
export class AdminModule { }
