require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));

app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public/checkout.html')));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✨ Beyond Beauty KE running at http://localhost:${PORT}`);
  console.log(`   Shop    → http://localhost:${PORT}/`);
  console.log(`   Checkout→ http://localhost:${PORT}/checkout`);
  console.log(`   Admin   → http://localhost:${PORT}/admin\n`);
});
