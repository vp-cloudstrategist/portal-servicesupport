require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const requireLogin = require('./middleware/requireLogin.js');
const ticketsRoutes = require('./routes/tickets.js');
const authRoutes = require('./routes/auth.js');
const userRoutes = require('./routes/users.js');
const companyRoutes = require('./routes/companies.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 } 
}));

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
});

app.get('/force-reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'force-reset-password.html'));
});

app.get('/verify-2fa', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'verify-2fa.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});