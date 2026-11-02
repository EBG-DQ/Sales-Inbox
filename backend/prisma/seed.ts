import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const salespeople = [
    { name: "Alex Morgan", email: "alex@example.com" },
    { name: "Jamie Lee", email: "jamie@example.com" },
    { name: "Taylor Kim", email: "taylor@example.com" },
  ];

  for (const salesperson of salespeople) {
    await prisma.salesperson.upsert({
      where: { email: salesperson.email },
      update: { name: salesperson.name },
      create: salesperson,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
