const bcrypt = require('bcryptjs');
const prisma = require('../database/prisma');

async function main() {
  // Default department
  let dept = await prisma.department.findFirst({ where: { name: 'بدون واحد' } });
  if (!dept) {
    dept = await prisma.department.create({ data: { name: 'بدون واحد' } });
    console.log('Created default department:', dept.name);
  }

  // Default admin user
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!existingAdmin) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe!123';
    const hash = await bcrypt.hash(defaultPassword, 10);
    const admin = await prisma.user.create({
      data: {
        id: 1000,
        password: hash,
        fullName: 'مدیر سیستم',
        role: 'admin',
        departmentId: dept.id,
        mustChangePassword: true,
      },
    });
    await prisma.leaveBalance.create({ data: { userId: admin.id, totalDays: 0, usedHours: 0 } });
    console.log('Created admin user (must change password):', admin.fullName);
  }

  // Default work shifts
  const shifts = [
    ['عادی کاری', '08:00', '17:00', 'شیفت عادی کاری', '#3b82f6'],
    ['شیفت عصر', '13:00', '22:00', 'شیفت عصر', '#f59e0b'],
    ['شیفت شب', '22:00', '06:00', 'شیفت شب', '#111827'],
  ];
  const shiftCount = await prisma.workShift.count();
  if (shiftCount === 0) {
    for (const [name, start, end, desc, color] of shifts) {
      await prisma.workShift.create({ data: { name, startTime: start, endTime: end, description: desc, color } });
    }
    console.log('Created default work shifts');
  }

  // Default inventory items
  const items = [
    ['میز اداری', 'میز کار اداری', 'عدد'],
    ['صندلی اداری', 'صندلی گردان', 'عدد'],
    ['کامپیوتر', 'کیس و مانیتور', 'عدد'],
    ['پرینتر', 'پرینتر لیزری', 'عدد'],
    ['کاغذ A4', 'بسته 500 برگی', 'بسته'],
    ['خودکار', 'خودکار آبی', 'عدد'],
    ['پوشه', 'پوشه فنری', 'عدد'],
  ];
  const itemCount = await prisma.inventoryItem.count();
  if (itemCount === 0) {
    for (const [name, desc, unit] of items) {
      await prisma.inventoryItem.create({ data: { name, description: desc, unit } });
    }
    console.log('Created default inventory items');
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
