const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDb() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id                        INT AUTO_INCREMENT PRIMARY KEY,
      order_number              VARCHAR(50)     UNIQUE NOT NULL,
      customer_name             VARCHAR(255)    NOT NULL,
      customer_phone            VARCHAR(50)     NOT NULL,
      customer_email            VARCHAR(255),
      total_amount              DECIMAL(10,2)   NOT NULL,
      delivery_fee              DECIMAL(10,2)   DEFAULT 0,
      delivery_address          TEXT            NOT NULL,
      status                    VARCHAR(50)     DEFAULT 'pending',
      payment_status            VARCHAR(50)     DEFAULT 'pending',
      mpesa_checkout_request_id VARCHAR(255),
      mpesa_transaction_id      VARCHAR(255),
      created_at                DATETIME        DEFAULT CURRENT_TIMESTAMP,
      updated_at                DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      order_id     INT           NOT NULL,
      product_id   VARCHAR(255),
      product_name VARCHAR(255)  NOT NULL,
      quantity     INT           NOT NULL DEFAULT 1,
      unit_price   DECIMAL(10,2) NOT NULL,
      total_price  DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS restock_notifications (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      phone         VARCHAR(20)   NOT NULL,
      product_id    VARCHAR(255)  NOT NULL,
      variant_id    VARCHAR(255)  DEFAULT NULL,
      registered_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
      notified_at   DATETIME      DEFAULT NULL,
      opted_out     TINYINT(1)    DEFAULT 0,
      INDEX idx_product (product_id)
    )
  `);

  console.log('✓ Database tables ready');
}

module.exports = { pool, initDb };
