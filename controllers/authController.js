const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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


        const redisClient = req.app.get('redisClient');
        if (!redisClient || !redisClient.isReady) {
            console.error("[LOGIN] Cliente Redis não está pronto ou não foi encontrado!");
        } else {
            const daily2faKey = `2fa-completed:${user.id}`;
            const alreadyVerifiedToday = await new Promise((resolve, reject) => {
                redisClient.get(daily2faKey, (err, reply) => {
                    if (err) return reject(err);
                    resolve(reply);
                });
            });

            if (alreadyVerifiedToday === 'true') {
                req.session.user = { id: user.id, nome: user.nome, login: user.login, sobrenome: user.sobre, perfil: user.perfil };
                return res.status(200).json({ message: 'Login bem-sucedido!' });
            }
        }


        let otpToken;
        let responseMessage;
        const now = new Date();

        if (user.otp_token && user.otp_expires_at && new Date(user.otp_expires_at) > now) {
            otpToken = user.otp_token;
            responseMessage = 'Um código de verificação válido para hoje já foi enviado. Verifique seu e-mail.';
        } else {
            otpToken = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date();
            expiresAt.setHours(23, 59, 59, 999);
            await pool.query('UPDATE user SET otp_token = ?, otp_expires_at = ? WHERE id = ?', [otpToken, expiresAt, user.id]);
            responseMessage = 'Um novo código de verificação foi enviado para o seu e-mail.';
        }
const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:14px; color:#333; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:8px; overflow: hidden;">
        
        <div style="background-color:#3B82F6; padding:20px; text-align:center;">
             <img src="https://service.nexxtcloud.app/images/Nexxt-Cloud-Logo-4.png" alt="Nexxt Cloud" style="max-width: 150px; display: block; margin: 0 auto;">
        </div>

        <div style="padding:40px 30px; text-align:center; line-height:1.6; background-color: #ffffff;">
             <h2 style="color:#111827; margin: 0 0 10px 0; font-weight: 700;">Seu Código de Verificação</h2>
             
             <p style="font-size: 16px; margin-bottom: 30px;">Olá, <strong>${user.nome}</strong>!</p>
             
             <p style="color: #4B5563;">Use o código abaixo para completar seu acesso ao Portal:</p>

             <div style="margin:30px 0;">
                <span style="background-color:#F3F4F6; color: #3B82F6; font-size:32px; font-weight:bold; padding:15px 40px; border-radius:8px; display:inline-block; letter-spacing: 8px; border: 1px solid #E5E7EB;">
                  ${otpToken}
                </span>
             </div>
             
        </div>

        <div style="background-color:#3B82F6; padding:15px; text-align:center; font-size:12px; color:#ffffff;">
             Nexxt Cloud © 2025 • Todos os direitos reservados
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

exports.verify2FA = async (req, res) => {
    try {
        const { login, otpToken } = req.body;
        if (!login || !otpToken) {
            return res.status(400).json({ message: 'Login e código são obrigatórios.' });
        }
        const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
        const user = rows[0];
        const now = new Date();

        if (!user || user.otp_token !== otpToken || now > new Date(user.otp_expires_at)) {
            return res.status(401).json({ message: 'Código inválido ou expirado.' });
        }

        req.session.user = { id: user.id, nome: user.nome, login: user.login, sobrenome: user.sobre, perfil: user.perfil };

        const redisClient = req.app.get('redisClient');
        if (!redisClient || !redisClient.isReady) {
            console.error("[VERIFY] Cliente Redis não está pronto. Não foi possível marcar o 2FA como concluído.");
        } else {
            const daily2faKey = `2fa-completed:${user.id}`;
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            const secondsUntilEndOfDay = Math.round((endOfDay.getTime() - now.getTime()) / 1000);

            if (secondsUntilEndOfDay > 0) {
                redisClient.set(daily2faKey, 'true', 'EX', secondsUntilEndOfDay, (err, reply) => {
                    if (err) {
                        console.error(`[VERIFY] ERRO AO SALVAR A CHAVE NO REDIS:`, err);
                    } else {
                    }
                });
            }
        }
        
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
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:14px; color:#333; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:8px; overflow: hidden;">
        
        <div style="background-color:#3B82F6; padding:20px; text-align:center;">
             <img src="https://service.nexxtcloud.app/images/Nexxt-Cloud-Logo-4.png" alt="Nexxt Cloud" style="max-width: 150px; display: block; margin: 0 auto;">
        </div>

        <div style="padding:40px 30px; text-align:center; line-height:1.6; background-color: #ffffff;">
             <h2 style="color:#111827; margin: 0 0 20px 0; font-weight: 700;">Recuperação de Senha</h2>
             
             <p style="font-size: 16px; margin-bottom: 20px;">Olá, <strong>${user.nome}</strong>.</p>
             
             <p style="color: #4B5563; margin-bottom: 30px;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Portal Nexxt Cloud Support</strong>.
             </p>

             <div style="margin:35px 0;">
                <a href="${resetLink}" style="background-color:#3B82F6; color:#ffffff; padding:15px 30px; text-decoration:none; border-radius:6px; font-weight:bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.25);">
                    Redefinir minha senha
                </a>
             </div>
             
             <p style="font-size: 13px; color: #9CA3AF; margin-top: 30px;">
                Se você não fez esta solicitação, pode ignorar este e-mail com segurança.<br>Sua senha permanecerá inalterada.
             </p>
        </div>

        <div style="background-color:#3B82F6; padding:15px; text-align:center; font-size:12px; color:#ffffff;">
             Nexxt Cloud © 2025 • Todos os direitos reservados
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

       
        await pool.query("UPDATE user SET passwd = ?, statu = 'ativo' WHERE login = ?", [hashedPassword, login]);

        const [rows] = await pool.query('SELECT * FROM user WHERE login = ?', [login]);
        const user = rows[0];


        const otpToken = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 
        await pool.query('UPDATE user SET otp_token = ?, otp_expires_at = ? WHERE id = ?', [otpToken, expiresAt, user.id]);

        const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:14px; color:#333; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:8px; overflow: hidden;">
        
        <div style="background-color:#3B82F6; padding:20px; text-align:center;">
             <img src="https://service.nexxtcloud.app/images/Nexxt-Cloud-Logo-4.png" alt="Nexxt Cloud" style="max-width: 150px; display: block; margin: 0 auto;">
        </div>

        <div style="padding:40px 30px; text-align:center; line-height:1.6; background-color: #ffffff;">
             <h2 style="color:#111827; margin: 0 0 10px 0; font-weight: 700;">Seu Código de Verificação</h2>
             
             <p style="font-size: 16px; margin-bottom: 30px;">Olá, <strong>${user.nome}</strong>!</p>
             
             <p style="color: #4B5563;">Use o código abaixo para completar seu acesso ao Portal:</p>

             <div style="margin:30px 0;">
                <span style="background-color:#F3F4F6; color: #3B82F6; font-size:32px; font-weight:bold; padding:15px 40px; border-radius:8px; display:inline-block; letter-spacing: 8px; border: 1px solid #E5E7EB;">
                  ${otpToken}
                </span>
             </div>
             
        </div>

        <div style="background-color:#3B82F6; padding:15px; text-align:center; font-size:12px; color:#ffffff;">
             Nexxt Cloud © 2025 • Todos os direitos reservados
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
        
  
        delete req.session.forceResetLogin;

        return res.status(206).json({ message: 'Senha atualizada! Prossiga com a verificação de dois fatores.', login: user.login });

    } catch (error) {
        console.error('Erro ao forçar a troca de senha:', error);
        res.status(500).json({ message: 'Erro interno no servidor. Tente novamente.' });
    }
};