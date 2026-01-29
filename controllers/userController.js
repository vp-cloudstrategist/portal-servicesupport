const bcrypt = require('bcryptjs');
const pool = require('../config/db.js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const capitalize = (str) => {
    if (typeof str !== 'string' || !str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

exports.createUser = async (req, res) => {
    const loggedInUser = req.session.user;
    let { perfil, nome, sobrenome, login, telefone, area_ids } = req.body;

    if (loggedInUser.perfil !== 'admin' && loggedInUser.perfil !== 'gerente') {
        return res.status(403).json({ message: 'Você não tem permissão para criar usuários.' });
    }
    if (loggedInUser.perfil === 'gerente' && (perfil === 'admin' || perfil === 'gerente')) {
        return res.status(403).json({ message: 'Gerentes não podem criar usuários administradores ou outros gerentes.' });
    }

    if (!perfil || !nome || !sobrenome || !login) {
        return res.status(400).json({ message: 'Todos os campos do formulário selecionado são obrigatórios.' });
    }
    
    if (!Array.isArray(area_ids)) {
        area_ids = [];
    }

    if (perfil === 'user' && area_ids.length === 0) {
        return res.status(400).json({ message: 'Para Usuário Cliente, ao menos uma Área deve ser selecionada.' });
    }

    const connection = await pool.getConnection();
    try {
        if (loggedInUser.perfil === 'gerente') {
            const [managerAreasRows] = await connection.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
            const managerAreaIds = managerAreasRows.map(row => row.area_id);
            const canAssignAll = area_ids.every(id => managerAreaIds.includes(parseInt(id)));
            if (!canAssignAll) {
                connection.release();
                return res.status(403).json({ message: 'Você só pode criar usuários para as áreas às quais pertence.' });
            }
        }
        
        await connection.beginTransaction();
        const nomeCapitalized = capitalize(nome);
        const sobrenomeCapitalized = capitalize(sobrenome);

        const senhaTemporaria = crypto.randomBytes(8).toString('hex') + 'A1!';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senhaTemporaria, salt);
        
        const userSql = `INSERT INTO user (perfil, nome, sobre, login, passwd, telef, statu, criado) VALUES (?, ?, ?, ?, ?, ?, 'novo', NOW())`;
        const userValues = [perfil, nomeCapitalized, sobrenomeCapitalized, login, hashedPassword, telefone || null];
        const [userResult] = await connection.query(userSql, userValues);
        const newUserId = userResult.insertId;

        if (area_ids && area_ids.length > 0) {
            const areaValues = area_ids.map(areaId => [newUserId, areaId]);
            await connection.query('INSERT INTO user_areas (user_id, area_id) VALUES ?', [areaValues]);
        }
        await connection.commit();

       const emailHtml = `
      <div style="font-family: Arial, sans-serif; font-size:14px; color:#333; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px;">
        <div style="background-color:#f8f8f8; padding:20px; text-align:center;">
          <img src="https://support.nexxtcloud.app/images/Nexxt-Cloud-Logo-1.png" alt="Nexxt Cloud" width="200">
        </div>
        <div style="padding:30px; text-align:center; line-height:1.5;">
          <h2 style="color:#0c1231;">Bem-vindo(a)!</h2>
          <p>Olá <strong>${nomeCapitalized}</strong>,</p>
          <p>Sua conta foi criada com sucesso no Portal Nexxt Cloud Support.</p>
          <p>Abaixo está sua senha temporária para o primeiro acesso:</p>
          <div style="margin:30px 0;">
            <p style="background-color:#e9ecef; font-size:20px; font-weight:bold; padding:10px 20px; border-radius:6px; display:inline-block;">
              ${senhaTemporaria}
            </p>
          </div>
          <p style="font-size:12px; color:#777;">Recomendamos alterar sua senha após realizar o login.</p>
        </div>
        <div style="background-color:#f8f8f8; padding:20px; text-align:center; font-size:12px; color:#555;">
          Nexxt Cloud © 2025 • Todos os direitos reservados
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
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este email de login já está em uso.' });
        }
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    } finally {
        if (connection) connection.release();
    }
};
exports.deleteUser = async (req, res) => {
    const loggedInUserId = req.session.user.id;
    const { id: targetUserId } = req.params;

    // Medida de segurança: impede que um usuário se auto-delete
    if (String(loggedInUserId) === String(targetUserId)) {
        return res.status(400).json({ message: 'Você não pode deletar sua própria conta.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('DELETE FROM user_areas WHERE user_id = ?', [targetUserId]);

        const [deleteResult] = await connection.query('DELETE FROM user WHERE id = ?', [targetUserId]);

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        await connection.commit();
        res.status(200).json({ message: 'Usuário deletado com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao deletar usuário:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Não é possível deletar este usuário, pois ele possui tickets associados.' });
        }
        res.status(500).json({ message: 'Erro interno no servidor ao deletar o usuário.' });
    } finally {
        if (connection) connection.release();
    }
};
exports.getAllUsers = async (req, res) => {
    const loggedInUser = req.session.user;
    try {
        let query;
        let params = [];


        if (loggedInUser.perfil === 'admin' || loggedInUser.perfil === 'support') {
            query = 'SELECT id, nome, sobre, login, perfil, statu FROM user ORDER BY nome ASC';
        } else if (loggedInUser.perfil === 'gerente') {
            query = `
                SELECT DISTINCT u.id, u.nome, u.sobre, u.login, u.perfil, u.statu
                FROM user u
                INNER JOIN user_areas ua ON u.id = ua.user_id
                WHERE ua.area_id IN (SELECT area_id FROM user_areas WHERE user_id = ?)
                ORDER BY u.nome ASC
            `;
            params.push(loggedInUser.id);
        } else {
            return res.status(403).json({ message: 'Você não tem permissão para listar usuários.' });
        }
        
        const [users] = await pool.query(query, params);
        res.status(200).json(users);

    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.getUserById = async (req, res) => {
    const loggedInUser = req.session.user;
    const { id: targetUserId } = req.params;
    try {
        if (loggedInUser.perfil !== 'admin' && String(loggedInUser.id) !== String(targetUserId)) {
            if (loggedInUser.perfil === 'gerente') {
                const [managerAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
                const managerAreaIds = managerAreas.map(a => a.area_id);

                if (managerAreaIds.length === 0) {
                    return res.status(403).json({ message: 'Acesso negado. Gerente sem área definida.' });
                }

                const [targetUserAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [targetUserId]);
                const targetAreaIds = targetUserAreas.map(a => a.area_id);
                const hasSharedArea = managerAreaIds.some(id => targetAreaIds.includes(id));
                if (!hasSharedArea) {
                     return res.status(403).json({ message: 'Você não tem permissão para visualizar este usuário.' });
                }
            } else {
                return res.status(403).json({ message: 'Acesso negado.' });
            }
        }
        
        const [rows] = await pool.query(
            `SELECT u.id, u.nome, u.sobre, u.login, u.telef, u.perfil, GROUP_CONCAT(ua.area_id) as area_ids
             FROM user u
             LEFT JOIN user_areas ua ON u.id = ua.user_id
             WHERE u.id = ? GROUP BY u.id`,
            [targetUserId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        
        rows[0].area_ids = rows[0].area_ids ? rows[0].area_ids.split(',').map(Number) : [];
        res.status(200).json(rows[0]);

    } catch (error) {
        console.error("Erro ao buscar usuário por ID:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.updateUser = async (req, res) => {
    const loggedInUser = req.session.user;
    const { id: targetUserId } = req.params;
    let { nome, sobre, login, telef, perfil, area_ids, novaSenha } = req.body;

    if (area_ids === undefined || area_ids === null) {
        area_ids = [];
    } else if (!Array.isArray(area_ids)) {
        area_ids = [area_ids];
    }

    const connection = await pool.getConnection();
    try {
        if (loggedInUser.perfil !== 'admin' && loggedInUser.perfil !== 'gerente') {
            connection.release();
            return res.status(403).json({ message: 'Você não tem permissão para editar usuários.' });
        }

        const [[targetUser]] = await connection.query('SELECT perfil FROM user WHERE id = ?', [targetUserId]);
        if (!targetUser) {
            connection.release();
            return res.status(404).json({ message: 'Usuário alvo não encontrado.' });
        }

        if (loggedInUser.perfil === 'gerente') {
             if (targetUser.perfil === 'admin' || perfil === 'admin' || perfil === 'gerente') {
                 connection.release();
                 return res.status(403).json({ message: 'Gerentes não podem editar admins ou alterar perfis para admin/gerente.' });
             }
             const [managerAreas] = await connection.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
            const managerAreaIds = managerAreas.map(a => a.area_id);
            if (managerAreaIds.length === 0) {
                connection.release();
                return res.status(403).json({ message: 'Acesso negado. Você não pertence a nenhuma área.' });
            }

            const [targetUserAreas] = await connection.query('SELECT area_id FROM user_areas WHERE user_id = ?', [targetUserId]);
            const targetAreaIds = targetUserAreas.map(a => a.area_id);
            const hasSharedArea = managerAreaIds.some(id => targetAreaIds.includes(id));
            if (!hasSharedArea && targetAreaIds.length > 0) { 
                connection.release();
                return res.status(403).json({ message: 'Você não tem permissão para editar este usuário.' });
            }
        }
        
        await connection.beginTransaction();

        let sql = 'UPDATE user SET nome = ?, sobre = ?, login = ?, telef = ?, perfil = ?';
        const values = [nome, sobre, login, telef, perfil];
        if (novaSenha && novaSenha.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(novaSenha, salt);
            sql += ', passwd = ?';
            values.push(hashedPassword);
        }
        sql += ' WHERE id = ?';
        values.push(targetUserId);
        
        await connection.query(sql, values);
        
        await connection.query('DELETE FROM user_areas WHERE user_id = ?', [targetUserId]);
        if (area_ids.length > 0) {
            const areaValues = area_ids.map(areaId => [targetUserId, areaId]);
            await connection.query('INSERT INTO user_areas (user_id, area_id) VALUES ?', [areaValues]);
        }
        
        await connection.commit();
        res.status(200).json({ message: 'Usuário atualizado com sucesso!' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'O email de login informado já está em uso por outro usuário.' });
        }
        console.error('Erro ao atualizar usuário (Admin):', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.getCurrentUser = async (req, res) => {
    const userId = req.session.user.id;
    if (!userId) {
        return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    try {
        const sql = `
            SELECT 
                u.id, u.login, u.nome, u.sobre as sobrenome, u.telef as telefone, u.perfil,
                GROUP_CONCAT(ta.nome SEPARATOR ', ') as areas_nome,
                GROUP_CONCAT(ua.area_id) as area_ids
            FROM user u
            LEFT JOIN user_areas ua ON u.id = ua.user_id
            LEFT JOIN ticket_areas ta ON ua.area_id = ta.id
            WHERE u.id = ?
            GROUP BY u.id
        `;
        const [rows] = await pool.query(sql, [userId]);
        if (rows.length > 0) {
            rows[0].area_ids = rows[0].area_ids ? rows[0].area_ids.split(',').map(Number) : [];
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
    const userPerfil = req.session.user.perfil;
    let { nome, sobrenome, telefone, login, novaSenha, area_ids } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        let sql = 'UPDATE user SET nome = ?, sobre = ?, telef = ?, login = ?';
        const values = [nome, sobrenome, telefone, login];
        if (novaSenha && novaSenha.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(novaSenha, salt);
            sql += ', passwd = ?';
            values.push(hashedPassword);
        }
        sql += ' WHERE id = ?';
        values.push(userId);
        await connection.query(sql, values);
        if (userPerfil === 'admin') {
            if (!Array.isArray(area_ids)) area_ids = [];
            await connection.query('DELETE FROM user_areas WHERE user_id = ?', [userId]);
            if (area_ids.length > 0) {
                const areaValues = area_ids.map(areaId => [userId, areaId]);
                await connection.query('INSERT INTO user_areas (user_id, area_id) VALUES ?', [areaValues]);
            }
        }
        await connection.commit();
        req.session.user.login = login;
        res.status(200).json({ message: 'Seus dados foram atualizados com sucesso!' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'O email de login informado já está em uso por outro usuário.' });
        }
        console.error('Erro ao atualizar dados do usuário:', error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar dados.' });
    } finally {
        if (connection) connection.release();
    }
};