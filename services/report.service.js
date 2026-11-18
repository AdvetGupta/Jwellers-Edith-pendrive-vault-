const { getDb } = require('../database/connection');

class ReportService {
  getDashboardData() {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const todaySales = db.prepare(`
      SELECT COUNT(*) as bill_count, COALESCE(SUM(grand_total), 0) as total_revenue
      FROM bills WHERE DATE(bill_date) = ? AND status = 'active'
    `).get(today);

    const totalCustomers = db.prepare(`SELECT COUNT(*) as count FROM customers WHERE is_deleted = 0`).get().count;

    const outstandingKhata = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM khata_transactions
      WHERE id IN (SELECT MAX(id) FROM khata_transactions GROUP BY customer_id)
    `).get().total;

    const lowStock = db.prepare(`
      SELECT COUNT(*) as count FROM products WHERE quantity_in_stock <= 5 AND is_deleted = 0
    `).get().count;

    const recentBills = db.prepare(`
      SELECT b.id, b.invoice_number, b.bill_date, b.grand_total, b.payment_status, b.bill_type,
             c.name as customer_name
      FROM bills b LEFT JOIN customers c ON c.id = b.customer_id
      WHERE b.status = 'active'
      ORDER BY b.created_at DESC LIMIT 10
    `).all();

    const salesTrend = db.prepare(`
      SELECT DATE(bill_date) as date, COUNT(*) as bill_count, COALESCE(SUM(grand_total), 0) as revenue
      FROM bills WHERE DATE(bill_date) >= ? AND status = 'active'
      GROUP BY DATE(bill_date) ORDER BY date ASC
    `).all(sevenDaysAgo);

    const paymentMethods = db.prepare(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM payments WHERE DATE(payment_date) >= ?
      GROUP BY payment_method ORDER BY total DESC
    `).all(thirtyDaysAgo);

    const monthlySales = db.prepare(`
      SELECT strftime('%Y-%m', bill_date) as month, COUNT(*) as bill_count, COALESCE(SUM(grand_total), 0) as revenue
      FROM bills WHERE bill_date >= ? AND status = 'active'
      GROUP BY strftime('%Y-%m', bill_date) ORDER BY month ASC
    `).all(thirtyDaysAgo);

    const topProducts = db.prepare(`
      SELECT p.product_name, SUM(bi.quantity) as qty_sold, COALESCE(SUM(bi.total), 0) as revenue
      FROM bill_items bi JOIN products p ON p.id = bi.product_id
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.status = 'active' AND b.bill_date >= ?
      GROUP BY bi.product_id ORDER BY qty_sold DESC LIMIT 5
    `).all(thirtyDaysAgo);

    return {
      todaySales: {
        billCount: todaySales.bill_count,
        totalRevenue: todaySales.total_revenue
      },
      totalCustomers,
      outstandingKhata,
      lowStockCount: lowStock,
      recentBills,
      salesTrend,
      paymentMethods,
      monthlySales,
      topProducts
    };
  }
}

module.exports = new ReportService();
