import "dotenv/config";
import "reflect-metadata";
import { Keypair } from "@stellar/stellar-sdk";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from 'nestjs-pino';

import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";
import { JsonSerializationInterceptor } from "./common/interceptors/json-serialization.interceptor";

function validatePlatformStellarSecret(): void {
  const secret = process.env.PLATFORM_STELLAR_SECRET_KEY;
  if (!secret) {
    throw new Error('PLATFORM_STELLAR_SECRET_KEY is not set. Set a valid Stellar secret key (starts with "S...") in environment variables. Required for SEP-10 authentication and signing transaction challenges.')
  }
  try {
    Keypair.fromSecret(secret);
  } catch (e) {
    throw new Error(`PLATFORM_STELLAR_SECRET_KEY is malformed: ${e instanceof Error ? e.message : 'invalid format'}. Must be a valid Stellar secret key starting with "S".`)
  }
}

async function bootstrap() {
  validatePlatformStellarSecret();
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-idempotency-key',
      'x-request-id',
    ],
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalInterceptors(new JsonSerializationInterceptor());

  const openApiConfig = new DocumentBuilder()
    .setTitle("CryptoPay Network API")
    .setDescription(
      "NestJS API for the CryptoPay Network MVP. External banking, UPI, KYC, bridge, and anchor integrations are mocked.",
    )
    .setVersion("0.1.0")
    .addApiKey(
      {
        description: "Use the user id returned from /api/v1/auth/mock-login.",
        in: "header",
        name: "x-user-id",
        type: "apiKey",
      },
      "mock-user-id",
    )
    .addTag("Auth")
    .addTag("Users")
    .addTag("Wallets")
    .addTag("Merchants")
    .addTag("Transactions")
    .addTag("Rewards")
    .addTag("Campaigns")
    .addTag("Referrals")
    .addTag("Admin")
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 4000, "0.0.0.0");
}

void bootstrap();
