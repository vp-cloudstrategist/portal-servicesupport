const pool = require('../config/db.js');
const fs = require('fs');

exports.createTicket = async (req, res) => {
    const { area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao, alarme_inicio, alarme_fim, horario_acionamento } = req.body;
    const user_id = req.session.user.id;
    const anexo_path = req.file ? req.file.path : null;

    if (!area_id || !alerta_id || !grupo_id || !tipo_solicitacao_id || !prioridade_id || !alarme_inicio || !horario_acionamento) {
        return res.status(400).json({ message: 'Os campos Área, Alerta, Grupo, Tipo, Prioridade, Início do Alarme e Horário de Acionamento são obrigatórios.' });
    }

    try {
        const sql = `
            INSERT INTO tickets (
                user_id, area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao, 
                alarme_inicio, alarme_fim, anexo_path, horario_acionamento, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            user_id, area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, descricao || null,
            alarme_inicio, alarme_fim || null, anexo_path, horario_acionamento, 
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
    
    // ATUALIZADO: 'prioridades' foi trocado por 'prioridades_nomes'
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

        // --- FILTRO DE SEGURANÇA (SEMPRE APLICADO) ---
        if (loggedInUser.perfil !== 'admin') {
            const [userAreas] = await pool.query('SELECT area_id FROM user_areas WHERE user_id = ?', [loggedInUser.id]);
            if (userAreas.length > 0) {
                const areaIds = userAreas.map(a => a.area_id);
                whereClauses.push(`t.area_id IN (?)`);
                queryParams.push(areaIds);
            } else {
                whereClauses.push('1=0'); // Usuário sem área não vê nenhum ticket
            }
        }

        // --- FILTROS DINÂMICOS DA INTERFACE ---
        if (areas) {
            whereClauses.push(`t.area_id IN (?)`);
            queryParams.push(areas.split(','));
        }

        // LÓGICA DE FILTRO DE PRIORIDADE ATUALIZADA
        if (prioridades_nomes) {
            const nomesPrioridades = prioridades_nomes.split(',');
            // Cria uma expressão regular que busca por nomes que COMEÇAM com 'Alto' OU 'Médio', etc.
            // Ex: '^(Alto|Médio)'
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

        // --- EXECUÇÃO DAS QUERIES ---
        const countSql = `
            SELECT COUNT(*) as total 
            FROM tickets t 
            LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id
            ${finalWhereClause}
        `;
        const [[{ total }]] = await pool.query(countSql, queryParams);

        const ticketsSql = `
            SELECT 
                t.id, t.status, t.data_criacao, t.alarme_inicio, t.alarme_fim, t.horario_acionamento, 
                a.nome as area_nome, al.nome as alerta_nome, g.nome as grupo_nome,
                u.nome as user_nome, p.nome as prioridade_nome
            FROM tickets t
            LEFT JOIN ticket_areas a ON t.area_id = a.id
            LEFT JOIN ticket_alertas al ON t.alerta_id = al.id
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
            LEFT JOIN user u ON t.user_id = u.id
            LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id
            ${finalWhereClause}
            ${orderClause} 
            LIMIT ? OFFSET ?
        `;
        
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
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Aberto'"),
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Resolvido'"),
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Aguardando Aprovação'")
        ];
        
        const results = await Promise.all(queries);
        
        res.status(200).json({
            total: results[0][0][0].count,
            abertos: results[1][0][0].count,
            resolvidos: results[2][0][0].count,
            aprovacao: results[3][0][0].count
            // O campo 'encerrados' foi removido
        });
    } catch (error) {
        console.error("Erro ao buscar informações dos cards:", error);
        res.status(500).json({ message: 'Erro ao buscar informações dos cards.' });
    }
};

exports.getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);

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
    const { remove_anexo, horario_acionamento, new_comment_text, ...ticketData } = req.body;
    
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let newAnexoPath;
        const [existingTicketRows] = await connection.query('SELECT anexo_path FROM tickets WHERE id = ?', [ticketId]);
        const oldAnexoPath = existingTicketRows[0]?.anexo_path;

        if (req.file) { 
            newAnexoPath = req.file.path;
            if (oldAnexoPath && fs.existsSync(oldAnexoPath)) fs.unlinkSync(oldAnexoPath);
        } else if (remove_anexo === '1') { 
            newAnexoPath = null;
            if (oldAnexoPath && fs.existsSync(oldAnexoPath)) fs.unlinkSync(oldAnexoPath);
        } else { 
            newAnexoPath = oldAnexoPath;
        }

        // --- CORREÇÃO APLICADA AQUI ---
        // Extraímos a 'descricao' para garantir que ela não entre na query de atualização.
        const { descricao, ...camposParaAtualizar } = ticketData;
        const { area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, status, alarme_inicio, alarme_fim } = camposParaAtualizar;
        
        const sql = `
            UPDATE tickets SET 
                area_id = ?, alerta_id = ?, grupo_id = ?, tipo_solicitacao_id = ?, 
                prioridade_id = ?, status = ?, alarme_inicio = ?, alarme_fim = ?,
                anexo_path = ?, horario_acionamento = ?
            WHERE id = ?
        `;
        const values = [
            area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, status,
            alarme_inicio, alarme_fim || null, newAnexoPath, horario_acionamento, ticketId
        ];
        await connection.query(sql, values);

        if (new_comment_text && new_comment_text.trim() !== '') {
            const commentSql = 'INSERT INTO ticket_comments (ticket_id, user_id, comment_text) VALUES (?, ?, ?)';
            await connection.query(commentSql, [ticketId, userId, new_comment_text.trim()]);
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
        res.status(500).json({ message: 'Erro interno no servidor.' });
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
exports.createAlerta = async (req, res) => {
    const { areaId } = req.params;
    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ message: 'O nome do alerta é obrigatório.' });
    }
    if (!areaId) {
        return res.status(400).json({ message: 'A área de associação é obrigatória.' });
    }

    try {
        const sql = 'INSERT INTO ticket_alertas (nome, area_id) VALUES (?, ?)';
        const [result] = await pool.query(sql, [nome, areaId]);
        
        res.status(201).json({ 
            message: 'Alerta cadastrado com sucesso!', 
            novoAlerta: { id: result.insertId, nome: nome } 
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Este alerta já existe para esta área.' });
        }
        console.error("Erro ao criar alerta:", error);
        res.status(500).json({ message: 'Erro no servidor ao cadastrar alerta.' });
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
                whereClauses.push(`t.area_id IN (${areaIds.map(() => '?').join(',')})`);
                queryParams.push(...areaIds);
            } else {
                whereClauses.push('1=0'); // Usuário sem área não exporta nada
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
            LEFT JOIN ticket_areas a ON t.area_id = a.id
            LEFT JOIN ticket_alertas al ON t.alerta_id = al.id
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
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