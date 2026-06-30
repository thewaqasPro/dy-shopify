import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { key: "system.initialized" },
    create: { key: "system.initialized", value: { at: new Date().toISOString() } },
    update: { value: { at: new Date().toISOString() } }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
