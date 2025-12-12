import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async connectWithRetry(retries = 12, delay = 5000) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to the database');
        return;
      } catch (error) {
        this.logger.error(`Failed to connect to database (attempt ${i + 1}/${retries}): ${error.message}`);
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
