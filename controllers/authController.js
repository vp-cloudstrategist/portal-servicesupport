const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// VERIFICAÇÃO DE SENHA E ENVIO DE CÓDIGO 2FA PARA TODOS
exports.login = async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) {
            return res.status(400).json({ message: 'Login e senha são obrigatórios.' });
        }

        const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
        const user = rows[0];

        if (!user) { return res.status(401).json({ message: 'Credenciais inválidas.' }); }

        const isMatch = await bcrypt.compare(password, user.passwd);
        if (!isMatch) { return res.status(401).json({ message: 'Credenciais inválidas.' }); }
        
        if (user.statu === 'novo') {
            req.session.forceResetLogin = user.login;
            return res.status(202).json({ 
                message: 'Redefinição de senha obrigatória para primeiro acesso.',
                login: user.login 
            });
        }

        
        let otpToken;
        let responseMessage;
        const now = new Date();

        if (user.otp_token && user.otp_expires_at && new Date(user.otp_expires_at) > now) {
            otpToken = user.otp_token;
            responseMessage = 'Um código de verificação válido para hoje já foi enviado. Verifique seu e-mail (incluindo spam).';
            console.log(`Reenviando token diário existente (${otpToken}) para ${user.login}`);
        } else {
            otpToken = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Define a expiração para o final do dia de hoje (23:59:59)
            const expiresAt = new Date();
            expiresAt.setHours(23, 59, 59, 999);

            await pool.query('UPDATE user SET otp_token = ?, otp_expires_at = ? WHERE id = ?', [otpToken, expiresAt, user.id]);
            
            responseMessage = 'Um novo código de verificação foi enviado para o seu e-mail.';
            console.log(`Gerando novo token diário (${otpToken}) para ${user.login}`);
        }

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; font-size:14px; color:#333; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px;">
              <div style="background-color:#f8f8f8; padding:20px; text-align:center;">
                <img src="https://support.nexxtcloud.app/app/logo.png" alt="Nexxt Cloud" style="width:150px;">
              </div>
              <div style="padding:30px; text-align:center; line-height:1.5;">
                <h2 style="color:#0c1231;">Seu Código de Verificação</h2>
                <p>Olá <strong>${user.nome}</strong>,</p>
                <p>Use o código abaixo para completar seu login no Portal Nexxt Cloud Support.</p>
                <div style="margin:30px 0;">
                  <p style="background-color:#e9ecef; font-size:24px; font-weight:bold; padding:10px 20px; border-radius:6px; display:inline-block; letter-spacing: 5px;">
                    ${otpToken}
                  </p>
                </div>
                <p style="font-size:12px; color:#777;">Este código é válido para o dia de hoje.</p>
              </div>
              <div style="background-color:#f8f8f8; padding:20px; text-align:center; font-size:12px; color:#555;">
                Nexxt Cloud © 2025 • Todos os direitos reservados<br>
                <a href="https://service.nexxtcloud.app/login" style="color:#555; text-decoration:none;">service.nexxtcloud.app/login</a>
              </div>
            </div>
        `;
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, secure: false, 
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({
            from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
            to: user.login,
            subject: 'Seu Código de Verificação',
            html: emailHtml
        });
        
        return res.status(206).json({ message: responseMessage, login: user.login });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// VERIFICAÇÃO DO CÓDIGO 2FA
exports.verify2FA = async (req, res) => {
    try {
        const { login, otpToken } = req.body;
        if (!login || !otpToken) {
            return res.status(400).json({ message: 'Login e código são obrigatórios.' });
        }
        const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
        const user = rows[0];

        // Verifica se o token está correto e se não expirou
        if (!user || user.otp_token !== otpToken || new Date() > new Date(user.otp_expires_at)) {
            return res.status(401).json({ message: 'Código inválido ou expirado.' });
        }
        req.session.user = { id: user.id, nome: user.nome, login: user.login, sobrenome: user.sobre, perfil: user.perfil };
        res.status(200).json({ message: 'Login verificado com sucesso!' });
    } catch (error) {
        console.error('Erro na verificação 2FA:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// RECUPERAÇÃO DE SENHA
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [email]);
    if (rows.length === 0) {
      return res.status(200).json({ message: 'Se um usuário com este email existir, um link será enviado.' });
    }
    const user = rows[0];
    const emailBase64 = Buffer.from(user.login).toString('base64');
    const resetLink = `https://service.nexxtcloud.app/reset-password?user=${emailBase64}`;
    const emailHtml = `
      <div style="font-family: 'Space Grotesk', sans-serif; font-size:14px; color:#333; max-width:700px; margin:0 auto;">
          <div style="background-color:#ffffff; padding:30px; text-align:center;">
              <img src="https://support.nexxtcloud.app/app/logo.png" alt="Nexxt Cloud" width="200">
          </div>
          <div style="padding:20px; text-align:center; line-height:1.5;">
              <h2 style="color:#0c1231;">Recuperação de Senha</h2>
              <p>Olá <strong>${user.nome}</strong>,</p>
              <p>Recebemos o seu pedido para redefinição da senha de acesso ao <strong>Portal Nexxt Cloud Support</strong>.</p>
              <div style="margin:30px 0;">
                  <a href="${resetLink}" style="background-color:#2979FF; color:#fff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:bold;">Redefinir minha senha</a>
              </div>
              <p style="font-size:12px; color:#777;">Se você não fez esta solicitação, ignore este e-mail.</p>
          </div>
          <div style="padding:20px; text-align:center; font-size:12px; color:#555; background-color:#f8f8f8;">
              Nexxt Cloud © 2025 • Todos os direitos reservados<br>
              <a href="https://service.nexxtcloud.app/login" style="color:#555; text-decoration:none;">service.nexxtcloud.app/login</a>
          </div>
      </div>
    `;
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, 
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
      to: user.login,
      subject: 'Recuperação de Senha',
      html: emailHtml 
    });
    res.status(200).json({ message: 'Se um usuário com este email existir, um link será enviado.' });
  } catch (error) {
    console.error('Erro no forgotPassword:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

// RESETAR A SENHA
exports.resetPassword = async (req, res) => {
    const { user: emailBase64, password } = req.body;
    if (!emailBase64 || !password) {
        return res.status(400).json({ message: 'Informações inválidas.' });
    }
    try {
        const email = Buffer.from(emailBase64, 'base64').toString('ascii');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await pool.query('UPDATE user SET passwd = ? WHERE login = ?', [hashedPassword, email]);
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        console.error('Erro no resetPassword:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Erro ao fazer logout:', err);
      return res.status(500).json({ message: 'Não foi possível fazer logout.' });
    }
    res.clearCookie('connect.sid'); 
    res.status(200).json({ message: 'Logout bem-sucedido.' });
  });
};
exports.forceResetPassword = async (req, res) => {
    const { novaSenha } = req.body;
    const login = req.session.forceResetLogin;

    if (!login) {
        return res.status(401).json({ message: 'Sessão inválida ou expirada. Por favor, faça login novamente.' });
    }

    // Validação da força da senha (continua igual)
    const erros = [];
    if (!novaSenha || novaSenha.length < 8) {
        erros.push('A senha deve ter pelo menos 8 caracteres.');
    }
    if (!/[A-Z]/.test(novaSenha)) {
        erros.push('A senha deve conter pelo menos 1 letra maiúscula.');
    }
    if (!/[a-z]/.test(novaSenha)) {
        erros.push('A senha deve conter pelo menos 1 letra minúscula.');
    }
    if (!/[0-9]/.test(novaSenha)) {
        erros.push('A senha deve conter pelo menos 1 número.');
    }
    if (!/[^a-zA-Z0-9]/.test(novaSenha)) {
        erros.push('A senha deve conter pelo menos 1 caractere especial.');
    }

    if (erros.length > 0) {
        return res.status(400).json({ message: erros[0] });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(novaSenha, salt);

        // Atualiza senha e status
        await pool.query("UPDATE user SET passwd = ?, statu = 'ativo' WHERE login = ?", [hashedPassword, login]);

        // --- NOVO: LÓGICA DE 2FA INICIA AQUI ---
        // Busca os dados do usuário para poder enviar o email
        const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
        const user = rows[0];

        // Gera e salva o código 2FA (mesma lógica da função de login)
        const otpToken = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
        await pool.query('UPDATE user SET otp_token = ?, otp_expires_at = ? WHERE id = ?', [otpToken, expiresAt, user.id]);

        // Envia o email com o código 2FA
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; font-size:14px; color:#333; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px;">
              <div style="background-color:#f8f8f8; padding:20px; text-align:center;">
                <img src="https://support.nexxtcloud.app/app/logo.png" alt="Nexxt Cloud" style="width:150px;">
              </div>
              <div style="padding:30px; text-align:center; line-height:1.5;">
                <h2 style="color:#0c1231;">Seu Código de Verificação</h2>
                <p>Olá <strong>${user.nome}</strong>,</p>
                <p>Use o código abaixo para completar seu login no Portal Nexxt Cloud Support.</p>
                <div style="margin:30px 0;">
                  <p style="background-color:#e9ecef; font-size:24px; font-weight:bold; padding:10px 20px; border-radius:6px; display:inline-block; letter-spacing: 5px;">
                    ${otpToken}
                  </p>
                </div>
                <p style="font-size:12px; color:#777;">Este código é válido por 10 minutos.</p>
              </div>
            </div>
        `;
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, secure: false, 
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({
            from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
            to: user.login,
            subject: 'Seu Código de Verificação',
            html: emailHtml
        });
        
        // Remove a sessão temporária
        delete req.session.forceResetLogin;

        // ALTERADO: Responde com status 206, indicando que o próximo passo é o 2FA
        return res.status(206).json({ message: 'Senha atualizada! Prossiga com a verificação de dois fatores.', login: user.login });

    } catch (error) {
        console.error('Erro ao forçar a troca de senha:', error);
        res.status(500).json({ message: 'Erro interno no servidor. Tente novamente.' });
    }
};