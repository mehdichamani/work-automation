require('dotenv').config({ path: '../.env' });
const prisma = require('./database/prisma');
const fs = require('fs');
const path = require('path');

async function exportTree() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        users: true
      }
    });

    const deptMap = new Map();
    departments.forEach(d => deptMap.set(d.id, { ...d, children: [] }));

    const roots = [];
    deptMap.forEach(d => {
      if (d.parentId && deptMap.has(d.parentId)) {
        deptMap.get(d.parentId).children.push(d);
      } else {
        roots.push(d);
      }
    });

    const rows = [
      ['سطح', 'شناسه واحد', 'مسیر درختی واحد', 'نام واحد', 'کد پرسنلی', 'نام پرسنل', 'نقش سازمانی', 'نوع کاربری', 'وضعیت پرسنل']
    ];

    function getRoleTitle(role) {
      switch (role) {
        case 'admin': return 'مدیر سیستم';
        case 'manager': return 'مدیر';
        case 'supervisor': return 'سرپرست';
        case 'user': return 'پرسنل';
        default: return role || '';
      }
    }

    function traverse(dept, parentPath = '', level = 1) {
      const currentPath = parentPath ? `${parentPath} > ${dept.name}` : dept.name;
      const sortedUsers = [...dept.users].sort((a, b) => {
        const order = { admin: 1, manager: 2, supervisor: 3, user: 4 };
        return (order[a.role] || 5) - (order[b.role] || 5);
      });

      if (sortedUsers.length === 0) {
        rows.push([level, dept.id, currentPath, dept.name, '', '', '', '', '']);
      } else {
        for (const u of sortedUsers) {
          rows.push([
            level,
            dept.id,
            currentPath,
            dept.name,
            u.id,
            u.fullName,
            getRoleTitle(u.role),
            u.workType || 'عادی',
            u.isActive ? 'فعال' : 'غیرفعال'
          ]);
        }
      }

      for (const child of dept.children) {
        traverse(child, currentPath, level + 1);
      }
    }

    roots.sort((a, b) => a.id - b.id);
    roots.forEach(r => traverse(r));

    const unassignedUsers = await prisma.user.findMany({
      where: { departmentId: null }
    });

    if (unassignedUsers.length > 0) {
      for (const u of unassignedUsers) {
        rows.push([
          '-',
          '-',
          'بدون واحد',
          'بدون واحد',
          u.id,
          u.fullName,
          getRoleTitle(u.role),
          u.workType || 'عادی',
          u.isActive ? 'فعال' : 'غیرفعال'
        ]);
      }
    }

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const outputPath = path.join(__dirname, '..', 'organizational_chart_tree.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    console.log(`خروجی با موفقیت در فایل زیر ایجاد شد:\n${outputPath}\nتعداد ردیف‌ها: ${rows.length}`);
  } catch (error) {
    console.error('خطا در استخراج چارت:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportTree();
