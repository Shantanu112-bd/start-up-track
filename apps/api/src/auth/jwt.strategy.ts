import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { UserRole } from "../generated/prisma";
import type { AuthenticatedPrincipal } from "../common/decorators/current-user.decorator";

export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "fallback_secret",
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedPrincipal> {
    return {
      id: payload.sub,
      role: payload.role,
    };
  }
}
