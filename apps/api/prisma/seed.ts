import { PrismaClient, UserRole, MerchantStatus } from "./../src/generated/prisma";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Create Demo User
  const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo.user@cryptopay.network",
      displayName: "Demo User",
      role: UserRole.CONSUMER,
    },
  });
  console.log(`✅ Upserted Demo User (ID: ${user.id})`);

  // 2. Create Demo Wallet
  const DEMO_WALLET_ID = "00000000-0000-0000-0000-000000000002";
  const wallet = await prisma.wallet.upsert({
    where: { id: DEMO_WALLET_ID },
    update: {},
    create: {
      id: DEMO_WALLET_ID,
      userId: user.id,
      address: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      addressNormalized: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      publicKey: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      provider: "FREIGHTER",
      network: "STELLAR",
      status: "ACTIVE",
    },
  });
  console.log(`✅ Upserted Demo Wallet (ID: ${wallet.id})`);

  // 3. Create Demo Merchant
  const DEMO_MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
  const merchant = await prisma.merchant.upsert({
    where: { id: DEMO_MERCHANT_ID },
    update: {},
    create: {
      id: DEMO_MERCHANT_ID,
      ownerUserId: user.id,
      displayName: "Chai Point",
      legalName: "Chai Point Private Limited",
      merchantCode: "CHAI-123",
      status: MerchantStatus.APPROVED,
      defaultUpiVpa: "chaipoint@upi",
    },
  });
  console.log(`✅ Upserted Demo Merchant (ID: ${merchant.id})`);

  // 4. Create Demo QR Code
  const DEMO_QR_ID = "00000000-0000-0000-0000-000000000003";
  await prisma.merchantQrCode.upsert({
    where: { id: DEMO_QR_ID },
    update: {},
    create: {
      id: DEMO_QR_ID,
      merchantId: merchant.id,
      upiVpa: "chaipoint@upi",
      qrPayload: "upi://pay?pa=chaipoint@upi&pn=Chai%20Point",
      isActive: true,
      qrPayloadHash: "dummy-hash-123",
    },
  });
  console.log(`✅ Upserted Demo QR Code`);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
