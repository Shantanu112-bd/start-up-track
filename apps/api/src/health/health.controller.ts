import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: "Check API health" })
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
