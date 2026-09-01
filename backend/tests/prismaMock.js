const bcrypt = require('bcryptjs');

function matchWhere(row, where) {
  if (!where) return true;
  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR') { if (!value.some(c => matchWhere(row, c))) return false; continue; }
    if (key === 'AND') { if (!value.every(c => matchWhere(row, c))) return false; continue; }
    const rowVal = row[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) { if (!value.in.includes(rowVal)) return false; }
      else if ('startsWith' in value) { if (typeof rowVal !== 'string' || !rowVal.startsWith(value.startsWith)) return false; }
      else if ('not' in value) {
        const nv = value.not;
        if (typeof nv === 'object' && nv !== null) { if (matchWhere(row, { [key]: nv })) return false; }
        else { if (rowVal === nv) return false; }
      } else if ('contains' in value) {
        if (typeof rowVal !== 'string') return false;
        const hay = value.mode === 'insensitive' ? rowVal.toLowerCase() : rowVal;
        const ndl = value.mode === 'insensitive' ? value.contains.toLowerCase() : value.contains;
        if (!hay.includes(ndl)) return false;
      }
    } else { if (rowVal !== value) return false; }
  }
  return true;
}

const REL_FK = {
  user: 'userId', dept: 'departmentId', department: 'departmentId',
  supervisor: 'supervisorId', manager: 'managerId', creator: 'createdBy',
  uploader: 'uploadedBy', request: 'requestId', assignedUser: 'assignedTo',
  template: 'templateId', startedByUser: 'startedBy', actor: 'actorId',
};
const REL_MODEL = {
  user: 'user', dept: 'department', department: 'department',
  supervisor: 'user', manager: 'user', creator: 'user', uploader: 'user',
  assignedUser: 'user', template: 'workflowTemplate', startedByUser: 'user', actor: 'user',
};

function createMockPrisma() {
  const store = {
    user: [
      { id: 1000, password: bcrypt.hashSync('Test1234', 10), fullName: 'test-admin', role: 'admin', departmentId: 1, isActive: true, mustChangePassword: 1, phone: null, email: null, lastLogin: null, username: null, workType: 'normal', createdAt: new Date(), updatedAt: new Date() },
      { id: 1001, password: bcrypt.hashSync('Test1234', 10), fullName: 'test-user', role: 'user', departmentId: 2, isActive: true, mustChangePassword: 0, phone: null, email: null, lastLogin: null, username: null, workType: 'normal', createdAt: new Date(), updatedAt: new Date() },
      { id: 1002, password: bcrypt.hashSync('Test1234', 10), fullName: 'test-super', role: 'supervisor', departmentId: 2, isActive: true, mustChangePassword: 0, phone: null, email: null, lastLogin: null, username: null, workType: 'normal', createdAt: new Date(), updatedAt: new Date() },
      { id: 1003, password: bcrypt.hashSync('Test1234', 10), fullName: 'test-mgr', role: 'manager', departmentId: 2, isActive: true, mustChangePassword: 0, phone: null, email: null, lastLogin: null, username: null, workType: 'normal', createdAt: new Date(), updatedAt: new Date() },
    ],
    department: [
      { id: 1, name: 'dept-a', parentId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'dept-b', parentId: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ],
    leaveRequest: [], leaveBalance: [], leaveChangeLog: [], officialHoliday: [],
    overtimeRequest: [], letter: [], letterUnit: [], letterAttachment: [], letterHistory: [], letterCounter: [],
    purchaseRequest: [], purchaseItem: [], purchaseHistory: [], purchaseCounter: [],
    missionRequest: [], missionHistory: [], missionCounter: [],
    workOrder: [], workOrderHistory: [], workOrderCounter: [],
    paymentRequest: [], paymentHistory: [], paymentCounter: [],
    repairRequest: [], repairHistory: [], repairCounter: [],
    repairExternalRequest: [], repairExternalItem: [], repairExternalHistory: [],
    itRequest: [], itRequestHistory: [], itRequestCounter: [],
    conferenceBooking: [], conferenceHistory: [], conferenceCounter: [],
    securityReport: [], securityHistory: [],
    dailyOutput: [], dailyOutputHistory: [],
    projectSupplyRequest: [], projectSupplyRequestHistory: [], projectSupplyRequestCounter: [],
    inspectionRequest: [], inspectionHistory: [], inspectionCounter: [],
    dailyWorkReport: [], dailyWorkReportHistory: [],
    notification: [], signature: [], digitalSignature: [], signatureLog: [],
    activityLog: [], permission: [], smsCode: [],
    announcement: [
      { id: 1, title: 'test-ann', body: 'body', targetAudience: 'all', priority: 'normal', isActive: true, createdBy: 1000, imagePath: null, createdAt: new Date(), updatedAt: new Date() },
    ],
    inventoryItem: [], cardex: [], restaurantMenu: [], restaurantReservation: [],
    workShift: [], userShiftAssignment: [], shiftChangeRequest: [],
    chatRoom: [], chatMember: [], chatMessage: [],
    workflowTemplate: [], workflowInstance: [], workflowStepLog: [],
    backupSetting: [], backupLog: [], csvImportLog: [], setting: [],
    pageView: [],
    pushSubscription: [], attachment: [], jobApplication: [],
    jobApplicationWorkHistory: [], jobApplicationAttachment: [], jobApplicationCounter: [],
    educationalCategory: [], educationalMaterial: [], educationalAttachment: [], userLearningProgress: [],
  };
  let nextId = 10000;

  function resolveRelated(row, rel, config) {
    const fk = REL_FK[rel]; const fkVal = fk ? row[fk] : null;
    const mn = REL_MODEL[rel];
    if (fkVal == null || !mn || !store[mn]) return null;
    const relRow = store[mn].find(r => r.id === fkVal);
    if (!relRow) return null;
    return resolveIncludes(relRow, config);
  }

  function resolveIncludes(row, config) {
    if (!config) return { ...row };
    const selObj = config.select || {};
    const incObj = config.include || {};
    if (Object.keys(selObj).length > 0) {
      const sel = { id: row.id };
      for (const [rel, val] of Object.entries(selObj)) {
        if (val && typeof val === 'object' && (val.select || val.include)) sel[rel] = resolveRelated(row, rel, val);
        else if (val === true) sel[rel] = row[rel];
      }
      return sel;
    }
    const result = { ...row };
    for (const [rel, val] of Object.entries(incObj)) {
      result[rel] = resolveRelated(row, rel, val);
    }
    return result;
  }

  function makeModel(name) {
    const rows = store[name] || (store[name] = []);
    return {
      findFirst: async (args = {}) => { const m = rows.find(r => matchWhere(r, args.where)); return m ? resolveIncludes(m, args) : null; },
      findUnique: async (args = {}) => { const m = rows.find(r => matchWhere(r, args.where)); return m ? resolveIncludes(m, args) : null; },
      findMany: async (args = {}) => {
        let res = args.where ? rows.filter(r => matchWhere(r, args.where)) : [...rows];
        if (args.orderBy) {
          const ents = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
          res.sort((a, b) => { for (const o of ents) for (const [f, d] of Object.entries(o)) { if (a[f] === b[f]) continue; return d === 'desc' ? (a[f] < b[f] ? 1 : -1) : (a[f] < b[f] ? -1 : 1); } return 0; });
        }
        if (args.skip) res = res.slice(args.skip);
        if (args.take) res = res.slice(0, args.take);
        return res.map(r => resolveIncludes(r, args));
      },
      create: async (args) => { const row = { id: nextId++, ...args.data }; rows.push(row); return { ...row }; },
      createMany: async (args = {}) => { const data = Array.isArray(args.data) ? args.data : [args.data]; data.forEach(d => rows.push({ id: nextId++, ...d })); return { count: data.length }; },
      update: async (args) => { const i = rows.findIndex(r => matchWhere(r, args.where)); if (i >= 0) Object.assign(rows[i], args.data); return i >= 0 ? { ...rows[i] } : null; },
      updateMany: async (args = {}) => {
        let count = 0;
        rows.forEach(r => {
          if (matchWhere(r, args.where)) {
            Object.assign(r, args.data);
            count++;
          }
        });
        return { count };
      },
      delete: async (args) => { const i = rows.findIndex(r => matchWhere(r, args.where)); if (i >= 0) rows.splice(i, 1); return {}; },
      deleteMany: async (args = {}) => { const before = rows.length; if (!args || !args.where) { rows.length = 0; } else { const kept = rows.filter(r => !matchWhere(r, args.where)); rows.length = 0; rows.push(...kept); } return { count: before - rows.length }; },
      count: async (args = {}) => { if (!args.where) return rows.length; return rows.filter(r => matchWhere(r, args.where)).length; },
      aggregate: async (args = {}) => {
        const f = args.where ? rows.filter(r => matchWhere(r, args.where)) : rows;
        const r = {};
        if (args._sum) { r._sum = {}; for (const k of Object.keys(args._sum)) r._sum[k] = f.reduce((s, x) => s + (Number(x[k]) || 0), 0) || null; }
        if (args._count) r._count = { _all: f.length };
        return r;
      },
      groupBy: async (args = {}) => {
        const f = args.where ? rows.filter(r => matchWhere(r, args.where)) : rows;
        const g = {};
        for (const r of f) { const k = args.by.map(x => JSON.stringify(r[x])).join('||'); if (!g[k]) { g[k] = { _count: { _all: 0 } }; args.by.forEach(x => g[k][x] = r[x]); } g[k]._count._all++; }
        return Object.values(g);
      },
    };
  }

  const models = {};
  let proxyRef;
  const txProxy = { $transaction: async (fn) => fn(proxyRef) };
  proxyRef = new Proxy(txProxy, {
    get(target, prop) {
      if (prop === '$transaction') return target.$transaction;
      if (typeof prop === 'symbol') return undefined;
      if (!models[prop]) models[prop] = makeModel(prop);
      return models[prop];
    }
  });
  return proxyRef;
}

module.exports = { createMockPrisma };
