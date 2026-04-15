import "./src/env.js";
import { prisma } from "./src/lib/prisma.js";
import crypto from "crypto";

async function main() {
  try {
    const res = await prisma.campus.create({
      data: { code: 'TEST1' + Math.random().toString().slice(2, 6), name: 'Test Campus' }
    });
    console.log("Success:", res);
  } catch (e) {
    console.error("Prisma Error:", e);
  } finally {
    process.exit(0);
  }
}
main();
