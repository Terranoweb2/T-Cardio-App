import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class AdvertisementService {
  private readonly logger = new Logger(AdvertisementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Admin CRUD ───

  async create(data: any, adminId: string) {
    const ad = await this.prisma.advertisement.create({
      data: {
        type: data.type,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl || null,
        linkUrl: data.linkUrl || null,
        isActive: data.isActive ?? true,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        targetAudience: data.targetAudience || 'ALL',
        priority: data.priority || 0,
        createdBy: adminId,
      },
    });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'CREATE',
      resourceType: 'advertisement',
      resourceId: ad.id,
      details: { type: ad.type, title: ad.title },
    });

    this.logger.log(`Advertisement created: id=${ad.id}, type=${ad.type}, title="${ad.title}"`);
    return ad;
  }

  async findAll(page: number = 1, limit: number = 20, type?: string) {
    const where: any = {};
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.advertisement.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.advertisement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const ad = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Publicite non trouvee');
    return ad;
  }

  async update(id: string, data: any, adminId: string) {
    const ad = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Publicite non trouvee');

    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.targetAudience !== undefined) updateData.targetAudience = data.targetAudience;
    if (data.priority !== undefined) updateData.priority = data.priority;

    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'UPDATE',
      resourceType: 'advertisement',
      resourceId: id,
      details: data,
    });

    return updated;
  }

  async remove(id: string, adminId: string) {
    const ad = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Publicite non trouvee');

    await this.prisma.advertisement.delete({ where: { id } });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'DELETE',
      resourceType: 'advertisement',
      resourceId: id,
      details: { title: ad.title, type: ad.type },
    });

    this.logger.log(`Advertisement deleted: id=${id}, title="${ad.title}"`);
    return { success: true };
  }

  async toggleActive(id: string, adminId: string) {
    const ad = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Publicite non trouvee');

    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: { isActive: !ad.isActive },
    });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'UPDATE',
      resourceType: 'advertisement',
      resourceId: id,
      details: { isActive: updated.isActive },
    });

    return updated;
  }

  // ─── Public: Active ads for users ───

  async getActiveAds(userRole: string) {
    const now = new Date();
    const targetAudiences: string[] = ['ALL'];

    if (userRole === 'PATIENT') targetAudiences.push('PATIENT');
    if (userRole === 'MEDECIN' || userRole === 'CARDIOLOGUE') targetAudiences.push('MEDECIN');

    return this.prisma.advertisement.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gt: now },
        targetAudience: { in: targetAudiences as any },
      },
      orderBy: { priority: 'desc' },
    });
  }
}
