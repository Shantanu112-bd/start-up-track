import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { UserStatus } from "../../generated/prisma";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../decorators/current-user.decorator";

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers["x-user-id"];
    const userId = Array.isArray(header) ? header[0] : header;

    if (userId === undefined || userId.trim() === "") {
      throw new UnauthorizedException("Missing x-user-id header");
    }

    const user = await this.prisma.user.findFirst({
      select: {
        id: true,
        role: true,
        status: true,
      },
      where: { id: userId, deletedAt: null },
    });

    if (user === null || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is not active");
    }

    request.user = {
      id: user.id,
      role: user.role,
    };

    return true;
  }
}
