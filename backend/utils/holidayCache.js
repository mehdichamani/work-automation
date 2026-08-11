const prisma = require('../database/prisma');

let holidayCache = null;
let holidayCacheTime = 0;
const HOLIDAY_CACHE_TTL = 60000;

async function getHolidays() {
  const now = Date.now();
  if (!holidayCache || now - holidayCacheTime > HOLIDAY_CACHE_TTL) {
    const rows = await prisma.officialHoliday.findMany({ select: { holidayDate: true } });
    holidayCache = rows.map((r) => ({ holiday_date: r.holidayDate }));
    holidayCacheTime = now;
  }
  return holidayCache;
}

function invalidateHolidayCache() {
  holidayCache = null;
  holidayCacheTime = 0;
}

module.exports = {
  getHolidays,
  invalidateHolidayCache
};
