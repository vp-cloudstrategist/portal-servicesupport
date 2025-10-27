const pool = require('../config/db.js');
const fs = require('fs');
const { Parser } = require('json2csv');

const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

exports.createTicket = async (req, res) => {
    let { alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao, alarme_inicio, alarme_fim, horario_acionamento, status_id } = req.body; // MODIFICADO
    const user_id = req.session.user.id;
    const anexo_path = req.file ? req.file.path : null;

    if (!grupo_id || !alerta_id || !tipo_solicitacao_id || !prioridade_id || !alarme_inicio || alarme_inicio === 'null' || !horario_acionamento || horario_acionamento === 'null' || !status_id) { // MODIFICADO
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    if (!alarme_fim || alarme_fim === 'null') {
        alarme_fim = null;
    }

    try {
        const sql = `
            INSERT INTO tickets (
                user_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao, 
                alarme_inicio, alarme_fim, anexo_path, horario_acionamento, status_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `; // MODIFICADO
        const values = [
            user_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao || null,
            alarme_inicio, alarme_fim, anexo_path, horario_acionamento,
            status_id // MODIFICADO
        ];

        const [result] = await pool.query(sql, values);
        res.status(201).json({ message: `Ticket #${result.insertId} criado com sucesso!` });
    } catch (error) {
        console.error("Erro ao criar ticket:", error);
        res.status(500).json({ message: 'Erro interno ao criar o ticket.' });
    }
};

exports.getAllTickets = async (req, res) => {
    const loggedInUser = req.session.user;
    const pagina = parseInt(req.query.pagina || '1', 10);
    const limite = parseInt(req.query.limite || '20', 10);
    const offset = (pagina - 1) * limite;
    const { ordenar } = req.query;

    const orderMap = {
        'id_desc': 'ORDER BY t.id DESC',
        'data_criacao_desc': 'ORDER BY t.data_criacao DESC',
        'status_asc': 'ORDER BY s.nome ASC',
        'prioridade_asc': 'ORDER BY p.id ASC',
        'acionamento_desc': 'ORDER BY t.horario_acionamento DESC',
        'acionamento_asc': 'ORDER BY t.horario_acionamento ASC'
    };
    const orderClause = orderMap[ordenar || 'id_desc'] || 'ORDER BY t.id DESC';

    try {
        // 1. Constrói os filtros
        const { whereClause, queryParams } = await buildTicketFilters(req.query, loggedInUser);
        
        // 2. Definimos a lista COMPLETA de joins que esta query sempre precisa
        const allJoins = `
            LEFT JOIN ticket_status s ON t.status_id = s.id
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
            LEFT JOIN ticket_areas a ON g.area_id = a.id
            LEFT JOIN ticket_alertas al ON t.alerta_id = al.id
            LEFT JOIN user u ON t.user_id = u.id
            LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id
            LEFT JOIN (
                SELECT 
                    ticket_id, 
                    comment_text,
                    ROW_NUMBER() OVER(PARTITION BY ticket_id ORDER BY created_at DESC) as rn
                FROM ticket_comments
            ) AS lc ON t.id = lc.ticket_id AND lc.rn = 1
        `;

        // 3. Query de Contagem
        const countFilters = await buildTicketFilters(req.query, loggedInUser);
        const countSql = `SELECT COUNT(DISTINCT t.id) as total 
                          FROM tickets t
                          ${countFilters.joins} 
                          ${whereClause}`;
        const [[{ total }]] = await pool.query(countSql, queryParams);

        // 4. Query de Tickets
        const ticketsSql = `
            SELECT 
                t.id, t.data_criacao, t.alarme_inicio, t.alarme_fim, t.horario_acionamento, 
                t.descricao, s.nome as status, a.nome as area_nome, 
                al.nome as alerta_nome, g.nome as grupo_nome,
                u.nome as user_nome, p.nome as prioridade_nome,
                lc.comment_text as ultimo_comentario
            FROM tickets t
            ${allJoins}
            ${whereClause}
            -- ===== LINHA CORRIGIDA (GROUP BY t.id foi removido) =====
            ${orderClause} 
            LIMIT ? OFFSET ?`;

        const finalQueryParams = [...queryParams, limite, offset];
        const [tickets] = await pool.query(ticketsSql, finalQueryParams);

        res.status(200).json({ pagina, total, tickets });

    } catch (error) {
        console.error("Erro ao buscar tickets:", error);
        res.status(500).json({ message: 'Erro ao buscar tickets.' });
    }
};

exports.getCardInfo = async (req, res) => {
    try {
        const { joins, whereClause, queryParams } = await buildTicketFilters(req.query, req.session.user);

        const totalSql = `SELECT COUNT(DISTINCT t.id) as total FROM tickets t ${joins} ${whereClause}`;
        const [[{ total }]] = await pool.query(totalSql, queryParams);
        const statusCountsSql = `
            SELECT 
                s.nome, 
                COUNT(DISTINCT t.id) as count
            FROM ticket_status s
            LEFT JOIN tickets t ON s.id = t.status_id
            ${joins} 
            ${whereClause}
            GROUP BY s.id, s.nome
            ORDER BY s.id
        `;
        
        const [counts] = await pool.query(statusCountsSql, queryParams);

        // 4. Retorna o resultado
        res.status(200).json({
            total: total,
            counts: counts
        });

    } catch (error) {
        console.error("Erro ao buscar informações dos cards:", error);
        res.status(500).json({ message: 'Erro ao buscar informações dos cards.' });
    }
};
exports.getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        // ===== CONSULTA MODIFICADA para incluir o nome do status =====
        const sql = `
            SELECT 
                t.*, 
                g.area_id,
                s.nome as status 
            FROM tickets t
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
            LEFT JOIN ticket_status s ON t.status_id = s.id
            WHERE t.id = ?
        `;
        const [rows] = await pool.query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Ticket não encontrado.' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar ticket por ID:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.updateTicket = async (req, res) => {
    const { id: ticketId } = req.params;
    const userId = req.session.user.id;
    const newData = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [existingTicketRows] = await connection.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
        if (existingTicketRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Ticket não encontrado.' });
        }
        const oldData = existingTicketRows[0];

        // --- LÓGICA DE ATUALIZAÇÃO CORRIGIDA ---

        // 1. Começamos com os dados antigos como base
        const finalData = { ...oldData };

        // 2. Verificamos o status de forma inteligente
        let newStatusId = newData.status_id || newData.status; // Aceita 'status_id' ou 'status'
        
        // Se o status veio como nome (ex: "Resolvido"), buscamos o ID correspondente
        if (newStatusId && isNaN(parseInt(newStatusId))) {
            const [statusRows] = await connection.query('SELECT id FROM ticket_status WHERE nome = ?', [newStatusId]);
            if (statusRows.length > 0) {
                newStatusId = statusRows[0].id;
            }
        }
        
        // Atualiza o status_id em finalData se um novo ID válido foi encontrado
        if (newStatusId) {
            finalData.status_id = parseInt(newStatusId);
        }

        // 3. Atualizamos outros campos apenas se um novo valor foi enviado
        const fieldsToUpdate = ['alerta_id', 'grupo_id', 'tipo_solicitacao_id', 'prioridade_id', 'alarme_inicio', 'alarme_fim', 'horario_acionamento'];
        fieldsToUpdate.forEach(field => {
            // Só atualiza se o campo existir no 'newData' e não for indefinido
            if (newData[field] !== undefined) {
                // Converte strings 'null' ou vazias para o valor NULL do SQL
                finalData[field] = (newData[field] === 'null' || newData[field] === '') ? null : newData[field];
            }
        });

        // 4. Lógica para preencher 'alarme_fim' automaticamente
        const [statusRows] = await connection.query('SELECT nome FROM ticket_status WHERE id = ?', [finalData.status_id]);
        const statusName = statusRows.length > 0 ? statusRows[0].nome : '';
        if ((statusName === 'Resolvido' || statusName === 'Normalizado') && !finalData.alarme_fim) {
            finalData.alarme_fim = new Date();
        }

        // Lógica de anexo (mantida como estava)
        let newAnexoPath = oldData.anexo_path;
        if (req.file) {
            newAnexoPath = req.file.path;
            if (oldData.anexo_path && fs.existsSync(oldData.anexo_path)) fs.unlinkSync(oldData.anexo_path);
        } else if (newData.remove_anexo === '1') {
            newAnexoPath = null;
            if (oldData.anexo_path && fs.existsSync(oldData.anexo_path)) fs.unlinkSync(oldData.anexo_path);
        }
        
        // --- FIM DA LÓGICA CORRIGIDA ---

        const sql = `
            UPDATE tickets SET 
                alerta_id = ?, grupo_id = ?, tipo_solicitacao_id = ?, 
                prioridade_id = ?, status_id = ?, alarme_inicio = ?, alarme_fim = ?,
                anexo_path = ?, horario_acionamento = ?
            WHERE id = ?
        `;
        const values = [
            finalData.alerta_id, finalData.grupo_id, finalData.tipo_solicitacao_id,
            finalData.prioridade_id, finalData.status_id, finalData.alarme_inicio,
            finalData.alarme_fim, newAnexoPath, finalData.horario_acionamento, ticketId
        ];
        await connection.query(sql, values);

        if (newData.new_comment_text && newData.new_comment_text.trim() !== '') {
            const commentSql = 'INSERT INTO ticket_comments (ticket_id, user_id, comment_text) VALUES (?, ?, ?)';
            await connection.query(commentSql, [ticketId, userId, newData.new_comment_text.trim()]);
        }

        await connection.commit();
        res.status(200).json({ message: `Ticket #${ticketId} atualizado com sucesso!` });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao atualizar ticket:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    } finally {
        if (connection) connection.release();
    }
};
exports.deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const [ticketRows] = await pool.query('SELECT anexo_path FROM tickets WHERE id = ?', [id]);
        const anexoPath = ticketRows[0]?.anexo_path;

        const [deleteResult] = await pool.query('DELETE FROM tickets WHERE id = ?', [id]);

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Ticket não encontrado.' });
        }

        if (anexoPath && fs.existsSync(anexoPath)) {
            fs.unlinkSync(anexoPath);
            console.log(`Arquivo deletado: ${anexoPath}`);
        }

        res.status(200).json({ message: `Ticket #${id} deletado com sucesso!` });

    } catch (error) {
        console.error("Erro ao deletar ticket:", error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Não é possível deletar este ticket pois ele possui dados relacionados.' });
        }
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

const getOptions = (tableName) => async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id, nome FROM ${tableName} ORDER BY nome ASC`);
        res.status(200).json(rows);
    } catch (error) {
        console.error(`Erro ao buscar opções da tabela ${tableName}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.getAreas = getOptions('ticket_areas');
exports.getPrioridades = getOptions('ticket_prioridades');
exports.getGruposByArea = async (req, res) => {
    try {
        const { areaId } = req.params;
        const [rows] = await pool.query('SELECT id, nome FROM ticket_grupos WHERE area_id = ? ORDER BY nome ASC', [areaId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar grupos por área:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.getAlertasByArea = async (req, res) => {
    try {
        const { areaId } = req.params;
        const [rows] = await pool.query('SELECT id, nome FROM ticket_alertas WHERE area_id = ? ORDER BY nome ASC', [areaId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar alertas por área:", error);
        res.status(500).json({ message: 'Erro interno.' });
    }
};
exports.getTiposByArea = async (req, res) => {
    try {
        const { areaId } = req.params;
        const [rows] = await pool.query('SELECT id, nome FROM ticket_tipos_solicitacao WHERE area_id = ? ORDER BY nome ASC', [areaId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar tipos por área:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.getPrioridadesByArea = async (req, res) => {
    try {
        const { areaId } = req.params;
        const [rows] = await pool.query('SELECT id, nome FROM ticket_prioridades WHERE area_id = ? ORDER BY nome ASC', [areaId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar prioridades por área:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.createArea = async (req, res) => {
    const { nome } = req.body;
    if (!nome) {
        return res.status(400).json({ message: 'O nome da área é obrigatório.' });
    }
    try {
        const [result] = await pool.query('INSERT INTO ticket_areas (nome) VALUES (?)', [capitalize(nome)]);
        
        res.status(201).json({ 
            message: 'Área cadastrada com sucesso!', 
            novaArea: { id: result.insertId, nome: capitalize(nome) } 
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Essa área já está cadastrada.' });
        }
        console.error("Erro ao criar área:", error);
        res.status(500).json({ message: 'Erro no servidor ao cadastrar área.' });
    }
};
exports.deleteArea = async (req, res) => {
    const { id } = req.params;
    try {
        const [grupos] = await pool.query('SELECT id FROM ticket_grupos WHERE area_id = ? LIMIT 1', [id]);
        if (grupos.length > 0) return res.status(400).json({ message: 'Não é possível excluir: existem grupos associados a esta área.' });

        const [deleteResult] = await pool.query('DELETE FROM ticket_areas WHERE id = ?', [id]);
        if (deleteResult.affectedRows === 0) return res.status(404).json({ message: 'Área não encontrada.' });

        res.status(200).json({ message: 'Área deletada com sucesso!' });
    } catch (error) {
        console.error("Erro ao deletar área:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.createAlerta = async (req, res) => {
    const { areaId } = req.params;
    const { nome } = req.body;
    const nomeCapitalized = capitalize(nome);

    if (!nome) return res.status(400).json({ message: 'O nome do alerta é obrigatório.' });
    if (!areaId) return res.status(400).json({ message: 'A área de associação é obrigatória.' });

    try {
        const sql = 'INSERT INTO ticket_alertas (nome, area_id) VALUES (?, ?)';
        const [result] = await pool.query(sql, [nomeCapitalized, areaId]);
        res.status(201).json({
            message: 'Alerta cadastrado com sucesso!',
            novoAlerta: { id: result.insertId, nome: nomeCapitalized }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este alerta já existe para esta área.' });
        }
        console.error("Erro ao criar alerta:", error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};
exports.deleteAlerta = async (req, res) => {
    const { id } = req.params;
    try {
        const [tickets] = await pool.query('SELECT id FROM tickets WHERE alerta_id = ? LIMIT 1', [id]);
        if (tickets.length > 0) return res.status(400).json({ message: `Não é possível excluir: este alerta está associado ao ticket #${tickets[0].id}.` });

        const [deleteResult] = await pool.query('DELETE FROM ticket_alertas WHERE id = ?', [id]);
        if (deleteResult.affectedRows === 0) return res.status(404).json({ message: 'Alerta não encontrado.' });

        res.status(200).json({ message: 'Alerta deletado com sucesso!' });
    } catch (error) {
        console.error("Erro ao deletar alerta:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.createTipo = async (req, res) => {
    const { areaId } = req.params;
    const { nome } = req.body;
    const nomeCapitalized = capitalize(nome);
    if (!nome || !areaId) return res.status(400).json({ message: 'Nome e área são obrigatórios.' });
    try {
        const sql = 'INSERT INTO ticket_tipos_solicitacao (nome, area_id) VALUES (?, ?)';
        const [result] = await pool.query(sql, [nomeCapitalized, areaId]);
        res.status(201).json({ message: 'Tipo de solicitação criado!', novoItem: { id: result.insertId, nome: nomeCapitalized } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este tipo de solicitação já existe.' });
        console.error("Erro ao criar tipo:", error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

exports.deleteTipo = async (req, res) => {
    const { id } = req.params;
    try {
        const [tickets] = await pool.query('SELECT id FROM tickets WHERE tipo_solicitacao_id = ? LIMIT 1', [id]);
        if (tickets.length > 0) return res.status(400).json({ message: `Não é possível excluir: este tipo está associado ao ticket #${tickets[0].id}.` });

        const [deleteResult] = await pool.query('DELETE FROM ticket_tipos_solicitacao WHERE id = ?', [id]);
        if (deleteResult.affectedRows === 0) return res.status(404).json({ message: 'Tipo de solicitação não encontrado.' });

        res.status(200).json({ message: 'Tipo de solicitação deletado com sucesso!' });
    } catch (error) {
        console.error("Erro ao deletar tipo:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.createPrioridade = async (req, res) => {
    const { areaId } = req.params;
    const { nome } = req.body;
    const nomeCapitalized = capitalize(nome);
    if (!nome || !areaId) return res.status(400).json({ message: 'Nome e área são obrigatórios.' });
    try {
        const sql = 'INSERT INTO ticket_prioridades (nome, area_id) VALUES (?, ?)';
        const [result] = await pool.query(sql, [nomeCapitalized, areaId]);
        res.status(201).json({ message: 'Prioridade criada!', novoItem: { id: result.insertId, nome: nomeCapitalized } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Esta prioridade já existe.' });
        console.error("Erro ao criar prioridade:", error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};
exports.deletePrioridade = async (req, res) => {
    const { id } = req.params;
    try {
        const [tickets] = await pool.query('SELECT id FROM tickets WHERE prioridade_id = ? LIMIT 1', [id]);
        if (tickets.length > 0) return res.status(400).json({ message: `Não é possível excluir: esta prioridade está associada ao ticket #${tickets[0].id}.` });

        const [deleteResult] = await pool.query('DELETE FROM ticket_prioridades WHERE id = ?', [id]);
        if (deleteResult.affectedRows === 0) return res.status(404).json({ message: 'Prioridade não encontrada.' });

        res.status(200).json({ message: 'Prioridade deletada com sucesso!' });
    } catch (error) {
        console.error("Erro ao deletar prioridade:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};


exports.getCommentsByTicketId = async (req, res) => {
    const { id: ticketId } = req.params;
    try {
        const sql = `
            SELECT 
                tc.id,
                tc.comment_text,
                tc.created_at,
                u.nome as user_nome,
                u.sobre as user_sobrenome
            FROM ticket_comments tc
            JOIN user u ON tc.user_id = u.id
            WHERE tc.ticket_id = ?
            ORDER BY tc.created_at ASC
        `;
        const [comments] = await pool.query(sql, [ticketId]);
        res.status(200).json(comments);
    } catch (error) {
        console.error("Erro ao buscar comentários:", error);
        res.status(500).json({ message: 'Erro ao buscar comentários.' });
    }
};
exports.createGrupo = async (req, res) => {
    const { areaId } = req.params;
    const { nome } = req.body;
    const nomeCapitalized = capitalize(nome);

    if (!nome) return res.status(400).json({ message: 'O nome do grupo é obrigatório.' });
    if (!areaId) return res.status(400).json({ message: 'A área de associação é obrigatória.' });

    try {
        const sql = 'INSERT INTO ticket_grupos (nome, area_id) VALUES (?, ?)';
        const [result] = await pool.query(sql, [nomeCapitalized, areaId]);
        res.status(201).json({
            message: 'Grupo cadastrado com sucesso!',
            novoGrupo: { id: result.insertId, nome: nomeCapitalized }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este grupo já existe para esta área.' });
        }
        console.error("Erro ao criar grupo:", error);
        res.status(500).json({ message: 'Erro no servidor ao criar grupo.' });
    }
};
exports.deleteGrupo = async (req, res) => {
    const { id } = req.params; // Alterado de grupoId para id
    try {
        // Verifica se o grupo está sendo usado em algum ticket
        const [tickets] = await pool.query('SELECT id FROM tickets WHERE grupo_id = ? LIMIT 1', [id]);
        if (tickets.length > 0) {
            return res.status(400).json({ message: `Não é possível excluir o grupo, pois ele está associado ao ticket #${tickets[0].id}.` });
        }

        const [deleteResult] = await pool.query('DELETE FROM ticket_grupos WHERE id = ?', [id]);

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Grupo não encontrado.' });
        }

        res.status(200).json({ message: 'Grupo deletado com sucesso!' });

    } catch (error) {
        console.error("Erro ao deletar grupo:", error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') { // Erro genérico de foreign key
            return res.status(400).json({ message: 'Não é possível excluir este grupo pois ele possui dados relacionados em outras tabelas.' });
        }
        res.status(500).json({ message: 'Erro interno no servidor ao deletar o grupo.' });
    }
};

exports.createComment = async (req, res) => {
    const { id: ticketId } = req.params;
    const { comment_text } = req.body;
    const userId = req.session.user.id;

    if (!comment_text || comment_text.trim() === '') {
        return res.status(400).json({ message: 'O comentário não pode estar vazio.' });
    }

    try {
        const sql = 'INSERT INTO ticket_comments (ticket_id, user_id, comment_text) VALUES (?, ?, ?)';
        const [result] = await pool.query(sql, [ticketId, userId, comment_text]);
        const [newCommentRows] = await pool.query(
            `SELECT tc.id, tc.comment_text, tc.created_at, u.nome as user_nome, u.sobre as user_sobrenome 
             FROM ticket_comments tc
             JOIN user u ON tc.user_id = u.id
             WHERE tc.id = ?`,
            [result.insertId]
        );

        res.status(201).json({ message: 'Comentário adicionado.', newComment: newCommentRows[0] });

    } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
        res.status(500).json({ message: 'Erro ao adicionar comentário.' });
    }
};
exports.exportTickets = async (req, res) => {
    const { format, year, months } = req.query;
    const loggedInUser = req.session.user;

    if (!format || !year) {
        return res.status(400).json({ message: 'Formato e ano são obrigatórios.' });
    }

    try {
        let whereClauses = [];
        const queryParams = [];

        if (loggedInUser.perfil !== 'admin') {
            const [userAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
            if (userAreas.length > 0) {
                const areaIds = userAreas.map(a => a.area_id);
                whereClauses.push(`g.area_id IN (?)`);
                queryParams.push(areaIds);
            } else {
                whereClauses.push('1=0');
            }
        }

        whereClauses.push('YEAR(t.data_criacao) = ?');
        queryParams.push(year);

        if (months) {
            const monthArray = months.split(',').map(Number);
            if (monthArray.length > 0) {
                whereClauses.push(`MONTH(t.data_criacao) IN (${monthArray.map(() => '?').join(',')})`);
                queryParams.push(...monthArray);
            }
        }

        const finalWhereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // ===== CONSULTA CORRIGIDA (adicionado JOIN com ticket_status) =====
        const ticketsSql = `
            SELECT 
                CONCAT('#INC-', t.id) as Ticket,
                a.nome as Area,
                t.data_criacao as "Data de Criação",
                u.nome as Usuário,
                p.nome as Prioridade,
                s.nome as Status, 
                al.nome as Alerta,
                g.nome as "Grupo Responsável",
                t.alarme_inicio as "Início Alarme",
                t.alarme_fim as "Fim Alarme",
                t.horario_acionamento as Atendimento,
                t.descricao as Descrição
            FROM tickets t
            LEFT JOIN ticket_status s ON t.status_id = s.id
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
            LEFT JOIN ticket_areas a ON g.area_id = a.id
            LEFT JOIN ticket_alertas al ON t.alerta_id = al.id
            LEFT JOIN user u ON t.user_id = u.id
            LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id
            ${finalWhereClause}
            ORDER BY t.id ASC
        `;

        const [tickets] = await pool.query(ticketsSql, queryParams);

        if (tickets.length === 0) {
            return res.status(404).send('Nenhum ticket encontrado para os filtros selecionados.');
        }

        switch (format) {
            case 'csv':
                const json2csvParser = new Parser();
                const csv = json2csvParser.parse(tickets);
                res.header('Content-Type', 'text/csv');
                res.attachment(`relatorio_tickets_${year}.csv`);
                return res.send(csv);
            
            // ... outros casos
            default:
                return res.status(400).send('Formato inválido.');
        }

    } catch (error) {
        console.error("Erro ao exportar tickets:", error);
        res.status(500).send('Erro interno ao gerar o relatório.');
    }
};
exports.getStatus = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome FROM ticket_status ORDER BY nome ASC');
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar status:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.createStatus = async (req, res) => {
    const { nome } = req.body;
    if (!nome) {
        return res.status(400).json({ message: 'O nome do status é obrigatório.' });
    }
    try {
        const [result] = await pool.query('INSERT INTO ticket_status (nome) VALUES (?)', [capitalize(nome)]);
        res.status(201).json({ message: 'Status criado com sucesso!', novoItem: { id: result.insertId, nome: capitalize(nome) } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este status já existe.' });
        }
        console.error("Erro ao criar status:", error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

exports.deleteStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const [tickets] = await pool.query('SELECT id FROM tickets WHERE status_id = ? LIMIT 1', [id]);
        if (tickets.length > 0) {
            return res.status(400).json({ message: `Não é possível excluir: este status está em uso no ticket #${tickets[0].id}.` });
        }
        
        const [deleteResult] = await pool.query('DELETE FROM ticket_status WHERE id = ?', [id]);
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Status não encontrado.' });
        }
        
        res.status(200).json({ message: 'Status deletado com sucesso!' });
    } catch (error) {
        console.error("Erro ao deletar status:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.updateAlerta = async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    const nomeCapitalized = capitalize(nome);

    if (!nome) {
        return res.status(400).json({ message: 'O nome do alerta é obrigatório.' });
    }

    try {
        const [result] = await pool.query('UPDATE ticket_alertas SET nome = ? WHERE id = ?', [nomeCapitalized, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Alerta não encontrado.' });
        }

        res.status(200).json({
            message: 'Alerta atualizado com sucesso!',
            itemAtualizado: { id: id, nome: nomeCapitalized }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Um alerta com este nome já existe.' });
        }
        console.error("Erro ao atualizar alerta:", error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar alerta.' });
    }
};

const buildTicketFilters = async (query, user) => {
    const { ordenar, areas, prioridades_nomes, usuarios, status, startDate, endDate } = query;
    const loggedInUser = user;

    let whereClauses = [];
    let queryParams = [];
    
    let joins = {
        status: 'LEFT JOIN ticket_status s ON t.status_id = s.id',
        grupos: 'LEFT JOIN ticket_grupos g ON t.grupo_id = g.id',
        areas: 'LEFT JOIN ticket_areas a ON g.area_id = a.id',
        alertas: 'LEFT JOIN ticket_alertas al ON t.alerta_id = al.id',
        users: 'LEFT JOIN user u ON t.user_id = u.id',
        prioridades: 'LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id'
    };
    
    let requiredJoins = new Set(); 
    if (loggedInUser.perfil !== 'admin') {
        requiredJoins.add('grupos');
        const [userAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
        if (userAreas.length > 0) {
            const areaIds = userAreas.map(a => a.area_id);
            const [allowedGroups] = await pool.query('SELECT id FROM ticket_grupos WHERE area_id IN (?)', [areaIds]);
            if (allowedGroups.length > 0) {
                const groupIds = allowedGroups.map(g => g.id);
                whereClauses.push(`t.grupo_id IN (?)`);
                queryParams.push(groupIds);
            } else {
                whereClauses.push('1=0');
            }
        } else {
            whereClauses.push('1=0');
        }
    }

    if (areas) {
        requiredJoins.add('grupos');
        const areaIds = areas.split(',');
        const [groupsInAreas] = await pool.query('SELECT id FROM ticket_grupos WHERE area_id IN (?)', [areaIds]);
        if (groupsInAreas.length > 0) {
            const groupIds = groupsInAreas.map(g => g.id);
            whereClauses.push(`t.grupo_id IN (?)`);
            queryParams.push(groupIds);
        } else {
            whereClauses.push('1=0');
        }
    }

    if (prioridades_nomes) {
        requiredJoins.add('prioridades');
        const nomesPrioridades = prioridades_nomes.split(',');
        const regexPattern = `^(${nomesPrioridades.join('|')})`;
        whereClauses.push(`p.nome RLIKE ?`);
        queryParams.push(regexPattern);
    }
    if (usuarios) {
        requiredJoins.add('users');
        whereClauses.push(`t.user_id IN (?)`);
        queryParams.push(usuarios.split(','));
    }
    
    if (status) {
        requiredJoins.add('status'); 
        const statusNames = status.split(',');
        whereClauses.push(`s.nome IN (?)`);
        queryParams.push(statusNames);
    }
    if (startDate && endDate) {
        whereClauses.push(`DATE(t.data_criacao) BETWEEN ? AND ?`);
        queryParams.push(startDate, endDate);
    }

    const finalWhereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const finalJoins = Array.from(requiredJoins).map(key => joins[key]).join(' ');

    return { joins: finalJoins, whereClause: finalWhereClause, queryParams: queryParams };
};