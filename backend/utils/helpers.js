const moment = require('moment-jalaali');
const prisma = require('../database/prisma');

const COUNTER_MODELS = {
  purchase_counter: 'purchaseCounter',
  mission_counter: 'missionCounter',
  work_order_counter: 'workOrderCounter',
  payment_counter: 'paymentCounter',
  repair_counter: 'repairCounter',
  it_request_counter: 'itRequestCounter',
  conference_counter: 'conferenceCounter',
  project_supply_requests_counter: 'projectSupplyRequestCounter',
  inspection_counter: 'inspectionCounter',
  letter_counter: 'letterCounter',
};

const HISTORY_MODELS = {
  purchase_history: 'purchaseHistory',
  mission_history: 'missionHistory',
  work_order_history: 'workOrderHistory',
  payment_history: 'paymentHistory',
  repair_history: 'repairHistory',
  repair_external_history: 'repairExternalHistory',
  it_request_history: 'itRequestHistory',
  conference_history: 'conferenceHistory',
  project_supply_requests_history: 'projectSupplyRequestHistory',
  inspection_history: 'inspectionHistory',
  letter_history: 'letterHistory',
};

async function notify(userId, title, body, link) {
  await prisma.notification.create({
    data: { userId: Number(userId), title, body, link },
  });
}

async function notifyAll(role, title, body, link) {
  const users = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
  });
  for (const u of users) {
    await notify(u.id, title, body, link);
  }
}

async function findSupervisorId(departmentId) {
  if (!departmentId) return null;
  const dept = await prisma.department.findUnique({ where: { id: Number(departmentId) } });
  if (!dept || !dept.parentId) return null;
  const sup = await prisma.user.findFirst({
    where: { departmentId: dept.parentId, role: 'supervisor' },
  });
  return sup ? sup.id : null;
}

async function getNextNumber(counterTable, prefix) {
  if (!COUNTER_MODELS[counterTable]) throw new Error('Invalid counter table');
  const modelName = COUNTER_MODELS[counterTable];
  const jalaliYear = moment().jYear();
  return prisma.$transaction(async (tx) => {
    const counter = await tx[modelName].findUnique({ where: { year: jalaliYear } });
    let nextNumber = 1;
    if (counter) {
      nextNumber = counter.lastNumber + 1;
      await tx[modelName].update({
        where: { id: counter.id },
        data: { lastNumber: nextNumber },
      });
    } else {
      await tx[modelName].create({ data: { year: jalaliYear, lastNumber: 1 } });
    }
    return `${prefix}-${jalaliYear}-${String(nextNumber).padStart(3, '0')}`;
  });
}

async function addHistory(table, idColumn, recordId, userId, userName, action, comment) {
  const modelName = HISTORY_MODELS[table];
  if (!modelName) throw new Error('Invalid history table');
  await prisma[modelName].create({
    data: {
      requestId: Number(recordId),
      userId: userId ? Number(userId) : null,
      userName,
      action,
      comment: comment || '',
    },
  });
}

/**
 * Executes a database operation (query or transaction) with retry logic
 * for transient errors like deadlocks (40P01) or serialization failures (40001).
 */
async function executeWithRetry(fn, retries = 3, delay = 100) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      // Check for PostgreSQL deadlock (40P01) or serialization failure (40001) codes.
      // Also check error message text as Prisma or driver might wrap the code.
      const isTransient = error.code === '40P01' ||
                          error.code === '40001' ||
                          (error.message && (error.message.includes('deadlock') || error.message.includes('serialization')));

      if (isTransient && attempt < retries) {
        console.warn(`[DB Retry] Transient database error (code: ${error.code}). Retrying in ${delay * attempt}ms... (Attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay * attempt)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

module.exports = { notify, notifyAll, findSupervisorId, getNextNumber, addHistory, executeWithRetry };
