import { prisma } from '../../database/prisma.js';

export const authRepository = {
  findByIdentifier(email: string | null, phone: string | null) {
    return prisma.user.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
      include: { entrepreneurProfile: true, expertProfile: true },
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { entrepreneurProfile: true, expertProfile: true },
    });
  },

  findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { entrepreneurProfile: true, expertProfile: true } } },
    });
  },
};
