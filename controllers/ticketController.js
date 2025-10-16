const pool = require('../config/db.js');
const fs = require('fs');   
const { Parser } = require('json2csv');

const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

exports.createTicket = async (req, res) => {
    // Mude de 'const' para 'let' nesta linha para permitir a modificação de 'alarme_fim'
    let { alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao, alarme_inicio, alarme_fim, horario_acionamento } = req.body;
    const user_id = req.session.user.id;
    const anexo_path = req.file ? req.file.path : null;

    if (!grupo_id || !alerta_id || !tipo_solicitacao_id || !prioridade_id || !alarme_inicio || !horario_acionamento) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    if (!alarme_fim || alarme_fim === 'null') {
        alarme_fim = null;
    }

    try {
        // Query SQL sem o campo 'assunto'
        const sql = `
            INSERT INTO tickets (
                user_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao, 
                alarme_inicio, alarme_fim, anexo_path, horario_acionamento, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `; 
        // Lista de valores sem o campo 'assunto'
        const values = [
            user_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao || null,
            alarme_inicio, alarme_fim, anexo_path, horario_acionamento, 
            'Em Atendimento'
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

    // --- PARÂMETROS DE CONSULTA ---
    const pagina = parseInt(req.query.pagina || '1', 10);
    const limite = parseInt(req.query.limite || '20', 10);
    const offset = (pagina - 1) * limite;
    
    const { ordenar, areas, prioridades_nomes, usuarios, status, startDate, endDate } = req.query;

    const orderMap = {
        'id_desc': 'ORDER BY t.id DESC',
        'data_criacao_desc': 'ORDER BY t.data_criacao DESC',
        'status_asc': 'ORDER BY t.status ASC',
        'prioridade_asc': 'ORDER BY p.id ASC',
        'acionamento_desc': 'ORDER BY t.horario_acionamento DESC',
        'acionamento_asc': 'ORDER BY t.horario_acionamento ASC'
    };
    const orderClause = orderMap[ordenar || 'id_desc'] || 'ORDER BY t.id DESC';

    try {
        let whereClauses = [];
        const queryParams = [];

        // --- FILTRO DE SEGURANÇA (LÓGICA ATUALIZADA PARA GRUPOS) ---
        if (loggedInUser.perfil !== 'admin') {
            const [userAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
            if (userAreas.length > 0) {
                const areaIds = userAreas.map(a => a.area_id);
                const [allowedGroups] = await pool.query('SELECT id FROM ticket_grupos WHERE area_id IN (?)', [areaIds]);
                if (allowedGroups.length > 0) {
                    const groupIds = allowedGroups.map(g => g.id);
                    whereClauses.push(`t.grupo_id IN (?)`);
                    queryParams.push(groupIds);
                } else {
                    whereClauses.push('1=0'); // Usuário está em áreas que não têm grupos
                }
            } else {
                whereClauses.push('1=0'); // Usuário sem área não vê nenhum ticket
            }
        }

        // --- FILTROS DINÂMICOS (LÓGICA ATUALIZADA PARA ÁREA) ---
        if (areas) {
            const areaIds = areas.split(',');
            const [groupsInAreas] = await pool.query('SELECT id FROM ticket_grupos WHERE area_id IN (?)', [areaIds]);
            if (groupsInAreas.length > 0) {
                const groupIds = groupsInAreas.map(g => g.id);
                whereClauses.push(`t.grupo_id IN (?)`);
                queryParams.push(groupIds);
            } else {
                 whereClauses.push('1=0'); // Filtrou por áreas que não têm grupos
            }
        }
        
        if (prioridades_nomes) {
            const nomesPrioridades = prioridades_nomes.split(',');
            const regexPattern = `^(${nomesPrioridades.join('|')})`;
            whereClauses.push(`p.nome RLIKE ?`);
            queryParams.push(regexPattern);
        }
        if (usuarios) {
            whereClauses.push(`t.user_id IN (?)`);
            queryParams.push(usuarios.split(','));
        }
        if (status) {
            whereClauses.push(`t.status IN (?)`);
            queryParams.push(status.split(','));
        }
        if (startDate && endDate) {
            whereClauses.push(`DATE(t.data_criacao) BETWEEN ? AND ?`);
            queryParams.push(startDate, endDate);
        }

        const finalWhereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query de contagem corrigida (sem espaços inválidos)
        const countSql = `SELECT COUNT(*) as total 
            FROM tickets t
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
            LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id
            ${finalWhereClause}`;
        const [[{ total }]] = await pool.query(countSql, queryParams);

        // Query principal corrigida (sem espaços inválidos)
        const ticketsSql = `SELECT 
            t.id, t.status, t.data_criacao, t.alarme_inicio, t.alarme_fim, t.horario_acionamento, 
            a.nome as area_nome, 
            al.nome as alerta_nome, 
            g.nome as grupo_nome,
            u.nome as user_nome, 
            p.nome as prioridade_nome
        FROM tickets t
        LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
        LEFT JOIN ticket_areas a ON g.area_id = a.id
        LEFT JOIN ticket_alertas al ON t.alerta_id = al.id
        LEFT JOIN user u ON t.user_id = u.id
        LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id
        ${finalWhereClause}
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
        const queries = [
            pool.query("SELECT COUNT(*) as count FROM tickets"),
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Em Atendimento'"),
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Resolvido'"),
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Encerrado'") 
        ];
        
        const results = await Promise.all(queries);
        
        res.status(200).json({
            total: results[0][0][0].count,
            emAtendimento: results[1][0][0].count, 
            resolvidos: results[2][0][0].count,
            encerrados: results[3][0][0].count  
        });
    } catch (error) {
        console.error("Erro ao buscar informações dos cards:", error);
        res.status(500).json({ message: 'Erro ao buscar informações dos cards.' });
    }
};
exports.getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `
            SELECT 
                t.*, 
                g.area_id 
            FROM tickets t
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
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

    
        let newAnexoPath;
        if (req.file) { 
            newAnexoPath = req.file.path;
            if (oldData.anexo_path && fs.existsSync(oldData.anexo_path)) fs.unlinkSync(oldData.anexo_path);
        } else if (newData.remove_anexo === '1') { 
            newAnexoPath = null;
            if (oldData.anexo_path && fs.existsSync(oldData.anexo_path)) fs.unlinkSync(oldData.anexo_path);
        } else { 
            newAnexoPath = oldData.anexo_path;
        }

        const finalData = {
            alerta_id: newData.alerta_id !== undefined ? newData.alerta_id : oldData.alerta_id,
            grupo_id: newData.grupo_id !== undefined ? newData.grupo_id : oldData.grupo_id,
            tipo_solicitacao_id: newData.tipo_solicitacao_id !== undefined ? newData.tipo_solicitacao_id : oldData.tipo_solicitacao_id,
            prioridade_id: newData.prioridade_id !== undefined ? newData.prioridade_id : oldData.prioridade_id,
            status: newData.status !== undefined ? newData.status : oldData.status,
            alarme_inicio: newData.alarme_inicio !== undefined ? newData.alarme_inicio : oldData.alarme_inicio,
            alarme_fim: newData.alarme_fim !== undefined ? newData.alarme_fim : oldData.alarme_fim,
            horario_acionamento: newData.horario_acionamento !== undefined ? newData.horario_acionamento : oldData.horario_acionamento
        };
        
        if ((finalData.status === 'Resolvido' || finalData.status === 'Normalizado') && (!finalData.alarme_fim || finalData.alarme_fim === 'null')) {
    finalData.alarme_fim = new Date(); 
}

     
        for (const key of ['alarme_inicio', 'alarme_fim', 'horario_acionamento']) {
            if (finalData[key] === 'null' || finalData[key] === '') {
                finalData[key] = null;
            }
        }

        const sql = `
            UPDATE tickets SET 
                alerta_id = ?, grupo_id = ?, tipo_solicitacao_id = ?, 
                prioridade_id = ?, status = ?, alarme_inicio = ?, alarme_fim = ?,
                anexo_path = ?, horario_acionamento = ?
            WHERE id = ?
        `;
        const values = [
            finalData.alerta_id, finalData.grupo_id, finalData.tipo_solicitacao_id, finalData.prioridade_id, finalData.status,
            finalData.alarme_inicio, finalData.alarme_fim, newAnexoPath, finalData.horario_acionamento, ticketId
        ];
        await connection.query(sql, values);

        // 6. Adiciona comentário (se houver)
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

// --- FUNÇÕES PARA BUSCAR OPÇÕES DOS SELETORES ---

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
        const [rows] = await pool.query('SELECT id, nome FROM ticket_prioridades WHERE area_id = ?', [areaId]);
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
        const [result] = await pool.query('INSERT INTO ticket_areas (nome) VALUES (?)', [nome]);
        res.status(201).json({ message: 'Área cadastrada com sucesso!', areaId: result.insertId });
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

        // Adiciona filtro de permissão por área (reutilizando a lógica)
         if (loggedInUser.perfil !== 'admin') {
            const [userAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
            if (userAreas.length > 0) {
                const areaIds = userAreas.map(a => a.area_id);
                // AQUI: Filtra por g.area_id em vez de t.area_id
                whereClauses.push(`g.area_id IN (?)`);
                queryParams.push(areaIds);
            } else {
                whereClauses.push('1=0'); 
            }
        }

        // Adiciona filtro de data
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

        const ticketsSql = `
            SELECT 
                CONCAT('#INC-', t.id) as Ticket,
                a.nome as Area,
                t.data_criacao as "Data de Criação",
                u.nome as Usuário,
                p.nome as Prioridade,
                t.status as Status,
                al.nome as Alerta,
                g.nome as "Grupo Responsável",
                t.alarme_inicio as "Início Alarme",
                t.alarme_fim as "Fim Alarme",
                t.horario_acionamento as Atendimento,
                t.descricao as Descrição
            FROM tickets t
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

            case 'pdf':
            case 'xlsx':
                return res.status(501).send('Este formato de exportação ainda não foi implementado.');

            default:
                return res.status(400).send('Formato inválido.');
        }

    } catch (error) {
        console.error("Erro ao exportar tickets:", error);
        res.status(500).send('Erro interno ao gerar o relatório.');
    }
};
