const express = require('express');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const moment = require('moment-jalaali');

module.exports = function(db) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/monthly', (req, res) => {
    try {
      const { year, month } = req.query;
      const jalaliYear = year || moment().jYear();
      const jalaliMonth = month || moment().jMonth() + 1;
      const monthPrefix = `${jalaliYear}/${String(jalaliMonth).padStart(2, '0')}`;

      const leaveStats = db.prepare(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
               SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
               SUM(hours_count) as total_hours
        FROM leave_requests WHERE start_date LIKE ?
      `).get(monthPrefix + '%') || {};

      const overtimeStats = db.prepare(`
        SELECT COUNT(*) as total,
               COALESCE(SUM(hours_count), 0) as total_hours
        FROM overtime_requests WHERE start_date LIKE ? AND status != 'rejected'
      `).get(monthPrefix + '%') || {};

      const purchaseStats = db.prepare(`
        SELECT COUNT(*) as total FROM purchase_requests WHERE created_at LIKE ?
      `).get(monthPrefix + '%') || {};

      const missionStats = db.prepare(`
        SELECT COUNT(*) as total FROM mission_requests WHERE mission_date LIKE ? AND status != 'rejected'
      `).get(monthPrefix + '%') || {};

      const productionStats = db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(quantity), 0) as total_quantity
        FROM daily_output WHERE report_date LIKE ?
      `).get(monthPrefix + '%') || {};

      const workOrderStats = db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
        FROM work_orders WHERE created_at LIKE ?
      `).get(monthPrefix + '%') || {};

      const departmentStats = db.prepare(`
        SELECT d.name, COUNT(*) as request_count
        FROM leave_requests l
        JOIN users u ON l.user_id = u.id
        JOIN departments d ON u.department_id = d.id
        WHERE l.start_date LIKE ?
        GROUP BY d.name ORDER BY request_count DESC
      `).all(monthPrefix + '%');

      res.json({
        period: { year: jalaliYear, month: jalaliMonth },
        leave: leaveStats,
        overtime: overtimeStats,
        purchase: purchaseStats,
        mission: missionStats,
        production: productionStats,
        workOrder: workOrderStats,
        departments: departmentStats
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/user-summary', (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? (req.query.user_id || req.user.id) : req.user.id;
      const jalaliYear = moment().jYear();
      const jalaliMonth = moment().jMonth() + 1;
      const monthPrefix = `${jalaliYear}/${String(jalaliMonth).padStart(2, '0')}`;

      const leaves = db.prepare(`
        SELECT COUNT(*) as total, SUM(hours_count) as total_hours
        FROM leave_requests WHERE user_id = ? AND start_date LIKE ? AND status = 'approved'
      `).get(userId, monthPrefix + '%') || {};

      const overtime = db.prepare(`
        SELECT COUNT(*) as total,
               COALESCE(SUM(hours_count), 0) as total_hours
        FROM overtime_requests WHERE user_id = ? AND start_date LIKE ? AND status != 'rejected'
      `).get(userId, monthPrefix + '%') || {};

      const missions = db.prepare(`
        SELECT COUNT(*) as total FROM mission_requests WHERE user_id = ? AND mission_date LIKE ? AND status != 'rejected'
      `).get(userId, monthPrefix + '%') || {};

      res.json({ leave: leaves, overtime, mission: missions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
