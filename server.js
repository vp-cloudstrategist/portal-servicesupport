require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const redis = require('redis');

// Importação correta para connect-redis v6 (passando a sessão)
const RedisStore = require('connect-redis')(session);

// Inicializa o cliente do Redis (para a v4, com legacyMode)
const redisClient = redis.createClient({
    legacyMode: true 
});
redisClient.connect().catch(console.error);
console.log('Conectando ao cliente Redis...');

redisClient.on('connect', () => {
    console.log('Cliente Redis conectado com sucesso!');
});

redisClient.on('error', err => {
    console.error('Erro no cliente Redis:', err);
});

// Inicializa o "armazém" de sessões do Redis
const redisStore = new RedisStore({ client: redisClient, prefix: 'nexxt-sess:' });

// Importação das suas rotas e middlewares
const requireLogin = require('./middleware/requireLogin.js');
const authRoutes = require('./routes/auth.js');
const userRoutes = require('./routes/users.js');
const ticketRoutes = require('./routes/tickets');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração da sessão usando o RedisStore
app.use(session({
  store: redisStore, 
  secret: process.env.SESSION_SECRET, 
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));

// Rotas da API
app.use('/api/tickets', ticketRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Rotas das Páginas
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard', requireLogin, (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache', 
    'Expires': '0'
  });
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