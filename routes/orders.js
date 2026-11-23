const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const adminAuth = require('../middleware/adminAuth');

function generateOrderNumber() {
  return 'BB' + Date.now().toString(36).toUpperCase();
}

// POST /api/orders — create order
router.post('/', async (req, res) => {
  const { customer_name, customer_phone, customer_email, delivery_address, items } = req.body;
  if (!customer_name || !customer_phone || !delivery_address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'customer_name, customer_phone, delivery_address, and items are required' });
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const delivery_fee = subtotal >= 3000 ? 0 : 200;
  const total_amount = subtotal + delivery_fee;
  const order_number = generateOrderNumber();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO orders (order_number, customer_name, customer_phone, customer_email, total_amount, delivery_fee, delivery_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [order_number, customer_name, customer_phone, customer_email || null, total_amount, delivery_fee, delivery_address]
    );
    const orderId = result.insertId;
    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id || null, item.product_name, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
    }
    await conn.commit();
    res.status(201).json({ id: orderId, order_number, subtotal, delivery_fee, total_amount });
  } catch (e) {
    await conn.rollback();
    console.error('[Orders]', e.message);
    res.status(500).json({ error: 'Could not create order' });
  } finally {
    conn.release();
  }
});

// GET /api/orders/:id — get order + items (used for payment polling)
router.get('/:id', async (req, res) => {
  const [[order]] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
  res.json({ ...order, items });
});

// GET /api/orders — list all orders (admin only)
router.get('/', adminAuth, async (req, res) => {
  const [orders] = await pool.execute('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(orders);
});

// PUT /api/orders/:id/status — update order status (admin only)
router.put('/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true });
});

module.exports = router;
