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
            alarme_inicio, alarme_fim || null, anexo_path, horario_acionamento, 'Aberto'
        ];
        
        const [result] = await pool.query(sql, values);
        res.status(201).json({ message: `Ticket #${result.insertId} criado com sucesso!` });
    } catch (error) {
        console.error("Erro ao criar ticket:", error);
        res.status(500).json({ message: 'Erro interno ao criar o ticket.' });
    }
};

exports.getAllTickets = async (req, res) => {
    const pagina = parseInt(req.query.pagina || '1', 10);
    const limite = parseInt(req.query.limite || '20', 10);
    const ordenar = req.query.ordenar || 'id_desc';
    const offset = (pagina - 1) * limite;


    const orderMap = {
        'id_desc': 'ORDER BY t.id DESC',
        'data_criacao_desc': 'ORDER BY t.data_criacao DESC',
        'status_asc': 'ORDER BY t.status ASC',
        'prioridade_asc': 'ORDER BY p.id',
        'acionamento_desc': 'ORDER BY t.horario_acionamento DESC', 
        'acionamento_asc': 'ORDER BY t.horario_acionamento ASC'
    };
    const orderClause = orderMap[req.query.ordenar || 'id_desc'] || 'ORDER BY t.id DESC';

    try {
        const [[{ total }]] = await pool.query("SELECT COUNT(*) as total FROM tickets");
        const [tickets] = await pool.query(`
            SELECT 
                t.id, t.status, t.data_criacao,
                t.alarme_inicio, t.alarme_fim, t.horario_acionamento, 
                a.nome as area_nome,
                al.nome as alerta_nome,
                g.nome as grupo_nome,
                u.nome as user_nome,
                p.nome as prioridade_nome -- Busca o NOME da prioridade e renomeia para prioridade_nome
            FROM tickets t
            LEFT JOIN ticket_areas a ON t.area_id = a.id
            LEFT JOIN ticket_alertas al ON t.alerta_id = al.id
            LEFT JOIN ticket_grupos g ON t.grupo_id = g.id
            LEFT JOIN user u ON t.user_id = u.id
            LEFT JOIN ticket_prioridades p ON t.prioridade_id = p.id -- Faz o JOIN com a tabela de prioridades
            ${orderClause} 
            LIMIT ? OFFSET ?
        `, [parseInt(req.query.limite || '20', 10), (parseInt(req.query.pagina || '1', 10) - 1) * parseInt(req.query.limite || '20', 10)]);
        
        res.status(200).json({ pagina: parseInt(req.query.pagina || '1', 10), total, tickets });
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
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Aguardando Aprovação'"),
            pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Encerrado'")
        ];
        
        const results = await Promise.all(queries);
        
        res.status(200).json({
            total: results[0][0][0].count,
            abertos: results[1][0][0].count,
            resolvidos: results[2][0][0].count,
            aprovacao: results[3][0][0].count,
            encerrados: results[4][0][0].count
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
    try {
        const { id } = req.params;
        const { remove_anexo, horario_acionamento, ...ticketData } = req.body;
        let newAnexoPath;

        const [existingTicketRows] = await pool.query('SELECT anexo_path FROM tickets WHERE id = ?', [id]);
        const oldAnexoPath = existingTicketRows[0]?.anexo_path;

        if (req.file) { 
            newAnexoPath = req.file.path;
            if (oldAnexoPath && fs.existsSync(oldAnexoPath)) {
                fs.unlinkSync(oldAnexoPath);
            }
        } else if (remove_anexo === '1') { 
            newAnexoPath = null;
            if (oldAnexoPath && fs.existsSync(oldAnexoPath)) {
                fs.unlinkSync(oldAnexoPath);
            }
        } else { 
            newAnexoPath = oldAnexoPath;
        }

       const { area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, status, descricao, alarme_inicio, alarme_fim } = ticketData;
        
        const sql = `
            UPDATE tickets SET 
                area_id = ?, alerta_id = ?, grupo_id = ?, tipo_solicitacao_id = ?, 
                prioridade_id = ?, status = ?, descricao = ?, alarme_inicio = ?, alarme_fim = ?,
                anexo_path = ?, horario_acionamento = ?
            WHERE id = ?
        `;
        const values = [
            area_id, alerta_id, grupo_id, tipo_solicitacao_id, prioridade_id, status, descricao || null,
            alarme_inicio, alarme_fim || null, newAnexoPath, horario_acionamento, id
        ];

        await pool.query(sql, values);
        res.status(200).json({ message: `Ticket #${id} atualizado com sucesso!` });
    } catch (error) {
        console.error("Erro ao atualizar ticket:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
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