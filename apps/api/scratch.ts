import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.campus.create({ data: { code: 'TEST1', name: 'Test Campus' } });
    console.log(res);
  } catch (e) {
    console.error(e.name, e.message);
  }
}
main();
