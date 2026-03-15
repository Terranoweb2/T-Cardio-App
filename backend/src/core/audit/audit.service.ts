import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

interface AuditLogInput {
  userId?: string;
  userRole?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: input });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`);
    }
  }
}
