import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UnauthorizedException, BadRequestException, ForbiddenException, Headers } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

const SUPER_ADMIN_EMAIL = 'kwanphotofinder@gmail.com';

@Controller('admin')
export class AdminController {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    // Helper: extract and verify the caller from JWT
    private async getCallerFromToken(authHeader: string) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid authorization header');
        }
        const token = authHeader.replace('Bearer ', '');
        try {
            const decoded = this.jwtService.verify(token);
            const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
            if (!user) throw new UnauthorizedException('User not found');
            return user;
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }

    // Helper: check if caller is admin or super admin
    private assertAdmin(caller: any) {
        if (caller.role !== Role.ADMIN && caller.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('You must be an admin to perform this action');
        }
    }

    private assertSuperAdmin(caller: any) {
        if (caller.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only the super admin can perform this action');
        }
    }

    @Get('stats')
    async getStats() {
        const [
            totalUsers,
            totalEvents,
            totalPhotos,
            facesDetected,
            activeEvents,
            eventsByStatus,
            photosByStatus,
            usersByRole
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.event.count(),
            this.prisma.photo.count(),
            this.prisma.face.count(),
            this.prisma.event.count({ where: { status: 'PUBLISHED' } }),
            this.prisma.event.groupBy({
                by: ['status'],
                _count: true
            }),
            this.prisma.photo.groupBy({
                by: ['processingStatus'],
                _count: true
            }),
            this.prisma.user.groupBy({
                by: ['role'],
                _count: true
            })
        ]);

        return {
            totalUsers,
            totalEvents,
            totalPhotos,
            facesDetected,
            activeEvents,
            eventsByStatus: eventsByStatus.map(e => ({ status: e.status, count: e._count })),
            photosByStatus: photosByStatus.map(p => ({ status: p.processingStatus, count: p._count })),
            usersByRole: usersByRole.map(u => ({ role: u.role, count: u._count }))
        };
    }

    // ==================== USER MANAGEMENT ====================

    // GET /admin/users - List all users with their roles
    @Get('users')
    async getUsers(@Headers('authorization') authHeader: string) {
        const caller = await this.getCallerFromToken(authHeader);
        this.assertAdmin(caller);

        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatarUrl: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            users,
            callerRole: caller.role,
            callerEmail: caller.email,
        };
    }

    // POST /admin/users/set-role - Set a user's role (or pre-register an email)
    @Post('users/set-role')
    @HttpCode(HttpStatus.OK)
    async setUserRole(
        @Headers('authorization') authHeader: string,
        @Body() body: { email: string; role: string },
    ) {
        const caller = await this.getCallerFromToken(authHeader);
        this.assertAdmin(caller);

        const { email, role } = body;

        if (!email || !role) {
            throw new BadRequestException('Email and role are required');
        }

        const targetRole = role.toUpperCase() as Role;

        // Validate role
        if (!['STUDENT', 'PHOTOGRAPHER', 'ADMIN', 'SUPER_ADMIN'].includes(targetRole)) {
            throw new BadRequestException('Invalid role');
        }

        // Cannot set anyone as SUPER_ADMIN
        if (targetRole === Role.SUPER_ADMIN) {
            throw new ForbiddenException('Cannot assign SUPER_ADMIN role');
        }

        // Only super admin can set/remove ADMIN role
        if (targetRole === Role.ADMIN) {
            this.assertSuperAdmin(caller);
        }

        // Cannot modify the super admin account
        if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
            throw new ForbiddenException('Cannot modify the super admin account');
        }

        // Check if user exists
        let user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

        if (user) {
            // If demoting an admin, only super admin can do it
            if (user.role === Role.ADMIN && targetRole !== Role.ADMIN) {
                this.assertSuperAdmin(caller);
            }

            user = await this.prisma.user.update({
                where: { email: email.toLowerCase() },
                data: { role: targetRole },
            });
        } else {
            // Pre-register user with the specified role
            user = await this.prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    name: '',
                    role: targetRole,
                },
            });
        }

        return {
            message: `User ${email} has been set to ${targetRole}`,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }

    // DELETE /admin/users/:id/role - Demote user back to STUDENT
    @Delete('users/:id/role')
    async removeUserRole(
        @Headers('authorization') authHeader: string,
        @Param('id') userId: string,
    ) {
        const caller = await this.getCallerFromToken(authHeader);
        this.assertAdmin(caller);

        const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!targetUser) {
            throw new BadRequestException('User not found');
        }

        // Cannot modify the super admin
        if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
            throw new ForbiddenException('Cannot modify the super admin account');
        }

        // Only super admin can demote admins
        if (targetUser.role === Role.ADMIN || targetUser.role === Role.SUPER_ADMIN) {
            this.assertSuperAdmin(caller);
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { role: Role.STUDENT },
        });

        return {
            message: `User ${updatedUser.email} has been demoted to STUDENT`,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role,
            },
        };
    }
}
