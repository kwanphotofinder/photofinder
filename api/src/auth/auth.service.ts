import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

const SUPER_ADMIN_EMAIL = 'kwanphotofinder@gmail.com';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  async verifyGoogleToken(token: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const { email, name, picture, email_verified, hd } = payload;

      if (!email) {
        throw new UnauthorizedException('Email not found in Google token');
      }

      if (!email_verified) {
        throw new UnauthorizedException('Your Google email is not verified');
      }

      // Check domain allowlist
      const allowedDomains = ['mfu.ac.th', 'lamduan.mfu.ac.th'];
      const allowedEmails = [SUPER_ADMIN_EMAIL];

      const isAllowedDomain = (typeof hd === 'string' && allowedDomains.includes(hd)) || allowedDomains.some((domain) => email.endsWith(`@${domain}`));
      const isAllowedEmail = allowedEmails.includes(email.toLowerCase());

      // Also allow any email that is already pre-registered in the database (added by an admin)
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      const isPreRegistered = !!existingUser;

      if (!isAllowedDomain && !isAllowedEmail && !isPreRegistered) {
        throw new UnauthorizedException('You must use an MFU email or an authorized email to sign in');
      }

      let user = existingUser;

      if (!user) {
        // New user: super admin email gets SUPER_ADMIN, everyone else gets STUDENT
        const role = email.toLowerCase() === SUPER_ADMIN_EMAIL ? Role.SUPER_ADMIN : Role.STUDENT;

        user = await this.prisma.user.create({
          data: {
            email,
            name: name || '',
            avatarUrl: picture || null,
            role,
          },
        });
      } else {
        // Existing user: sync avatar and name, but respect database role
        // Only override role for the super admin email (always ensure SUPER_ADMIN)
        const updates: any = {};
        if (picture && user.avatarUrl !== picture) updates.avatarUrl = picture;
        if (name && user.name !== name) updates.name = name;
        if (email.toLowerCase() === SUPER_ADMIN_EMAIL && user.role !== Role.SUPER_ADMIN) {
          updates.role = Role.SUPER_ADMIN;
        }

        if (Object.keys(updates).length > 0) {
          user = await this.prisma.user.update({
            where: { email },
            data: updates,
          });
        }
      }

      const jwtToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        access_token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
      };
    } catch (error) {
      this.logger.error('Google token verification failed', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
