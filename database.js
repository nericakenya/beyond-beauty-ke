const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'beyondbeauty.db'));

db.exec(`PRAGMA journal_mode = WAL`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    description   TEXT    DEFAULT '',
    price         REAL    NOT NULL,
    original_price REAL,
    category      TEXT    NOT NULL,
    badge         TEXT,
    image_url     TEXT    DEFAULT '',
    stock_quantity INTEGER DEFAULT 99,
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number              TEXT    UNIQUE NOT NULL,
    customer_name             TEXT    NOT NULL,
    customer_phone            TEXT    NOT NULL,
    customer_email            TEXT,
    total_amount              REAL    NOT NULL,
    delivery_fee              REAL    DEFAULT 0,
    delivery_address          TEXT    NOT NULL,
    status                    TEXT    DEFAULT 'pending',
    payment_status            TEXT    DEFAULT 'pending',
    mpesa_checkout_request_id TEXT,
    mpesa_transaction_id      TEXT,
    created_at                TEXT    DEFAULT (datetime('now')),
    updated_at                TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id),
    product_id   INTEGER,
    product_name TEXT    NOT NULL,
    quantity     INTEGER NOT NULL DEFAULT 1,
    unit_price   REAL    NOT NULL,
    total_price  REAL    NOT NULL
  );
`);

// Seed products on first run
const { c } = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (c === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, price, original_price, category, badge, image_url, stock_quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN');
  try {
    const seeds = [
      ['Beaded Tote Bag', 2500, null, 'bags', 'New In', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 10],
      ['Floral Wrap Midi Dress', 3800, 5200, 'fashion', 'Sale', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80', 5],
      ['Gold Statement Earrings', 1200, null, 'jewellery', null, 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80', 20],
      ['Linen Co-ord Set', 4500, null, 'fashion', 'New In', 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ac2?w=600&q=80', 8],
      ['Woven Straw Clutch', 1800, null, 'bags', null, 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80', 15],
      ['Strappy Heeled Sandals', 3200, null, 'shoes', null, 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80', 12],
      ['Pearl Layered Necklace', 1500, null, 'jewellery', 'New In', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80', 18],
      ['Tailored Blazer Dress', 5200, null, 'fashion', null, 'https://images.unsplash.com/photo-1585914924626-15adac1e6402?w=600&q=80', 6],
      ['Silk Neck Scarf', 900, null, 'accessories', null, 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600&q=80', 25],
      ['Structured Mini Handbag', 4200, null, 'bags', 'New In', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 7],
      ['Crochet Crop Top', 2200, 3000, 'fashion', 'Sale', 'https://images.unsplash.com/photo-1582142306909-195724d33ffc?w=600&q=80', 10],
      ['Platform Mule Sandals', 2800, null, 'shoes', null, 'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=600&q=80', 9],
    ];
    for (const row of seeds) insert.run(...row);
    db.exec('COMMIT');
    console.log('✓ Database seeded with 12 products');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = db;
