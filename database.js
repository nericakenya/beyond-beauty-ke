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

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS thriftly_transactions (
      id                         VARCHAR(36)    PRIMARY KEY,
      listing_id                 VARCHAR(255)   NOT NULL,
      item_title                 VARCHAR(500)   NOT NULL,
      amount                     DECIMAL(10,2)  NOT NULL,
      buyer_phone                VARCHAR(30)    NOT NULL,
      buyer_token                VARCHAR(64)    NOT NULL,
      seller_phone               VARCHAR(30)    NOT NULL,
      seller_token               VARCHAR(64)    NOT NULL,
      status                     VARCHAR(50)    NOT NULL DEFAULT 'pending_payment',
      mpesa_checkout_request_id  VARCHAR(255),
      mpesa_receipt              VARCHAR(255),
      payout_conversation_id     VARCHAR(255),
      payout_receipt             VARCHAR(255),
      payout_queued_at           DATETIME,
      dispatched_at              DATETIME,
      confirmation_prompt_sent_at DATETIME,
      confirmed_at               DATETIME,
      completed_at               DATETIME,
      created_at                 DATETIME       DEFAULT CURRENT_TIMESTAMP,
      updated_at                 DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_listing (listing_id),
      INDEX idx_buyer_token (buyer_token),
      INDEX idx_seller_token (seller_token)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS thriftly_transaction_events (
      id             VARCHAR(36)   PRIMARY KEY,
      transaction_id VARCHAR(36)   NOT NULL,
      from_status    VARCHAR(50)   NOT NULL,
      to_status      VARCHAR(50)   NOT NULL,
      actor_type     VARCHAR(30)   NOT NULL,
      actor_id       VARCHAR(255),
      note           TEXT,
      created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tx (transaction_id)
    )
  `);

  console.log('✓ Database tables ready');
}

module.exports = { pool, initDb };
