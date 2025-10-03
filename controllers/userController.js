const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const capitalize = (str) => {
    if (typeof str !== 'string' || !str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

exports.createUser = async (req, res) => {
    let { perfil, nome, sobrenome, login, telefone, area_id } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!login || !emailRegex.test(login)) {
        return res.status(400).json({ message: 'Formato de e-mail inválido.' });
    }

    if (!perfil || !nome || !sobrenome || !login) {
        return res.status(400).json({ message: 'Todos os campos do formulário selecionado são obrigatórios.' });
    }
    if (perfil === 'user' && (!telefone || !area_id)) { // MUDOU
    return res.status(400).json({ message: 'Para Usuário Cliente, os campos Telefone e Área também são obrigatórios.' }); // MUDOU
}

    try {
        // NOVO: Aplica a capitalização no nome e sobrenome
        const nomeCapitalized = capitalize(nome);
        const sobrenomeCapitalized = capitalize(sobrenome);

        const senhaTemporaria = crypto.randomBytes(8).toString('hex') + 'A1!';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senhaTemporaria, salt);

       const sql = `
            INSERT INTO user (perfil, nome, sobre, login, passwd, telef, area_id, statu, criado) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', NOW())
            `;
        const values = [perfil, nomeCapitalized, sobrenomeCapitalized, login, hashedPassword, telefone || null, area_id || null];
        await pool.query(sql, values);

         const emailHtml = `
            <div style="font-family: Arial, sans-serif; text-align:center; max-width:600px; margin:auto; border:1px solid #ddd;">
                <div style="background-color:#f8f8f8; padding:20px;">
                    <img src="https://support.nexxtcloud.app/app/logo.png" alt="Nexxt Cloud" style="width:150px;">
                </div>
                <div style="padding:30px; line-height:1.5;">
                    <h2 style="color:#0c1231;">Bem-vindo ao Portal de Suporte</h2>
                    <p>Olá <strong>${nome}</strong>,</p>
                    <p>Uma conta foi criada para você em nosso portal. Use as seguintes credenciais para seu primeiro acesso:</p>
                    <p style="margin-top:20px;"><strong>Login:</strong> ${login}</p>
                    <p><strong>Senha Temporária:</strong> <span style="font-weight:bold; font-size:18px; color: #d9534f;">${senhaTemporaria}</span></p>
                    
                    <div style="margin:30px 0;">
                        <a href="https://service.nexxtcloud.app/login" style="background-color:#2979FF; color:white; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold; font-size:16px;">
                            Acessar o Portal
                        </a>
                    </div>
                    
                    <p style="margin-top:20px;">Por segurança, você será solicitado a criar uma nova senha pessoal após o login.</p>
                </div>
            </div>
        `;
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({
            from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
            to: login,
            subject: 'Bem-vindo ao Portal de Suporte Nexxt Cloud',
            html: emailHtml
        });

        res.status(201).json({ message: `Usuário ${nomeCapitalized} criado com sucesso! Um email com a senha temporária foi enviado.` });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este email de login já está em uso.' });
        }
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.getCurrentUser = async (req, res) => {
    const login = req.session.user.login;
    if (!login) {
        return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    try {
        const sql = `
            SELECT u.id, u.login, u.nome, u.sobre as sobrenome, u.telef as telefone, u.area_id, ta.nome as area_nome, u.perfil 
            FROM user u
            LEFT JOIN ticket_areas ta ON u.area_id = ta.id
            WHERE u.login = ?
        `;
        const [rows] = await pool.query(sql, [login]);
        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao carregar dados.' });
    }
};

exports.updateCurrentUser = async (req, res) => {
    const userId = req.session.user.id;
    const { nome, sobrenome, telefone, area_id, login, novaSenha } = req.body;

    try {
        let sql = 'UPDATE user SET nome = ?, sobre = ?, telef = ?, area_id = ?, login = ?';
        const values = [nome, sobrenome, telefone, area_id || null, login];
        if (novaSenha && novaSenha.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(novaSenha, salt);
            sql += ', passwd = ?';
            values.push(hashedPassword);
        }
        
        sql += ' WHERE id = ?';
        values.push(userId);
        
        await pool.query(sql, values);
        req.session.user.login = login;
        
        res.status(200).json({ message: 'Seus dados foram atualizados com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'O email de login informado já está em uso por outro usuário.' });
        }
        console.error('Erro ao atualizar dados do usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar dados.' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, nome, sobre, login, perfil, statu FROM user');
        res.status(200).json(users);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.updateUserById = async (req, res) => {
    const { id } = req.params;
    const { nome, sobre, login, telef, perfil, area_id, novaSenha } = req.body;

    try {
        let sql = 'UPDATE user SET nome = ?, sobre = ?, login = ?, telef = ?, perfil = ?, area_id = ?';
        const values = [nome, sobre, login, telef, perfil, area_id || null];
        if (novaSenha && novaSenha.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(novaSenha, salt);
            sql += ', passwd = ?';
            values.push(hashedPassword);
        }

        sql += ' WHERE id = ?';
        values.push(id);
        
        await pool.query(sql, values);
        res.status(200).json({ message: 'Usuário atualizado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'O email de login informado já está em uso por outro usuário.' });
        }
        console.error('Erro ao atualizar usuário (Admin):', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT id, nome, sobre, login, telef, perfil, area_id FROM user WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar usuário por ID:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};