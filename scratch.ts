console.log(process.env.DATABASE_URL)
import bcrypt from "bcrypt";
import "dotenv/config";
import { prisma } from "./apps/api/src/lib/prisma";

async function main() {
  const hash = await bcrypt.hash("password123", 12);

  // Create dummy campus if there isn't one
  const campus = await prisma.campus.findFirst();
  let campusId = campus?.id;

  if (!campusId) {
    const newCampus = await prisma.campus.create({
      data: {
        name: "Main Campus",
        code: "MAIN"
      }
    });
    campusId = newCampus.id;
  }

  const emp = await prisma.employee.upsert({
    where: { employeeId: "BDU00001" },
    update: { passwordHash: hash, status: "ACTIVE" },
    create: {
      employeeId: "BDU00001",
      fullName: "Admin User",
      email: "admin@bdu.edu.et",
      gender: "MALE",
      nationality: "Ethiopian",
      contactInfo: { phone: "+251911111111" },
      emergencyContact: { name: "Test Contact", phone: "+251922222222", relation: "Sibling" },
      dateOfBirth: new Date("1990-01-01"),
      campusId,
      passwordHash: hash,
      status: "ACTIVE",
      isTempPassword: false
    }
  });

  // Assign admin role
  await prisma.userRole.upsert({
    where: { employeeId: emp.id },
    update: { baseRole: "SUPER_ADMIN" },
    create: {
      employeeId: emp.id,
      baseRole: "SUPER_ADMIN"
    }
  });

  console.log("Admin employee upserted with ID BDU00001 and password 'password123'");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
