import { prisma } from '../database/prisma.js';
import { deliveryService } from './delivery.service.js';

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
}

export const notificationService = {
  async create(input: NotificationInput) {
    const [notification, recipient] = await prisma.$transaction([
      prisma.notification.create({ data: input }),
      prisma.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { fullName: true, email: true, phone: true },
      }),
    ]);
    void deliveryService.notification(recipient, input.title, input.message, input.href);
    return notification;
  },

  async createMany(userIds: string[], input: Omit<NotificationInput, 'userId'>) {
    await Promise.all(userIds.map((userId) => this.create({ userId, ...input })));
  },
};
