const express = require('express');
const router = express.Router();
const db = require('../database');
const adminAuth = require('../middleware/adminAuth');

function generateOrderNumber() {
  return 'BB' + Date.now().toString(36).toUpperCase();
}

// POST /api/orders — create order
router.post('/', (req, res) => {
  const { customer_name, customer_phone, customer_email, delivery_address, items } = req.body;
  if (!customer_name || !customer_phone || !delivery_address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'customer_name, customer_phone, delivery_address, and items are required' });
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const delivery_fee = subtotal >= 3000 ? 0 : 200;
  const total_amount = subtotal + delivery_fee;
  const order_number = generateOrderNumber();

  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, customer_name, customer_phone, customer_email, total_amount, delivery_fee, delivery_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  let id;
  try {
    const { lastInsertRowid: orderId } = insertOrder.run(
      order_number, customer_name, customer_phone, customer_email || null,
      total_amount, delivery_fee, delivery_address
    );
    for (const item of items) {
      insertItem.run(orderId, item.product_id || null, item.product_name, item.quantity, item.unit_price, item.unit_price * item.quantity);
    }
    db.exec('COMMIT');
    id = orderId;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.status(201).json({ id, order_number, subtotal, delivery_fee, total_amount });
});

// GET /api/orders/:id — get order + payment status (used for polling)
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  res.json({ ...order, items });
});

// GET /api/orders — list all orders (admin only)
router.get('/', adminAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders);
});

// PUT /api/orders/:id/status — update order status (admin only)
router.put('/:id/status', adminAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;
