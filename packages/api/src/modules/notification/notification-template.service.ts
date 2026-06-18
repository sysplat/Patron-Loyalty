import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  listTemplates(orgId: string) {
    return this.withOrg(orgId, (tx) =>
      tx.notificationTemplate.findMany({
        where: { orgId },
        orderBy: { type: 'asc' },
      }),
    );
  }

  async getTemplate(orgId: string, templateId: string) {
    return this.withOrg(orgId, async (tx) => {
      const template = await tx.notificationTemplate.findFirst({
        where: { id: templateId, orgId },
      });
      if (!template) throw new NotFoundException('Template not found');
      return template;
    });
  }

  createTemplate(
    orgId: string,
    data: {
      type: string;
      channel: string;
      subject?: string;
      body: string;
      variables?: string[];
    },
  ) {
    return this.withOrg(orgId, (tx) =>
      tx.notificationTemplate.create({
        data: {
          orgId,
          type: data.type,
          channel: data.channel,
          subject: data.subject,
          body: data.body,
          variables: data.variables ?? [],
        },
      }),
    );
  }

  async updateTemplate(
    orgId: string,
    templateId: string,
    data: Partial<{
      subject: string;
      body: string;
      variables: string[];
    }>,
  ) {
    await this.getTemplate(orgId, templateId);
    return this.withOrg(orgId, (tx) =>
      tx.notificationTemplate.update({ where: { id: templateId }, data }),
    );
  }

  async deleteTemplate(orgId: string, templateId: string) {
    await this.getTemplate(orgId, templateId);
    return this.withOrg(orgId, (tx) =>
      tx.notificationTemplate.delete({ where: { id: templateId } }),
    );
  }
}
