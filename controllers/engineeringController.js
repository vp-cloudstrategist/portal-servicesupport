const pool = require('../config/db.js');

const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

exports.createTicket = async (req, res) => {
    const { 
        tipo_solicitacao, 
        ambiente, 
        catalog_item_id, 
        prioridade, 
        descricao 
    } = req.body;
    
    // Pega o ID de quem está logado (seja cliente ou engenheiro criando para si mesmo)
    const cliente_id = req.session.user.id;
    
    // Trata o caminho do arquivo se houver upload
    const anexo_path = req.file ? req.file.path : null; 

    try {
        const sql = `
            INSERT INTO tickets_engenharia 
            (cliente_id, tipo_solicitacao, ambiente, catalog_item_id, prioridade, descricao, anexo_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            cliente_id, 
            tipo_solicitacao, 
            ambiente, 
            catalog_item_id, 
            prioridade, 
            descricao, 
            anexo_path // Apenas 7 itens, removendo qualquer NULL extra que havia antes
        ];
        
        await pool.query(sql, values);
        res.status(201).json({ message: 'Ticket criado com sucesso!' });
    } catch (error) {
        console.error("Erro ao criar ticket:", error);
        res.status(500).json({ message: 'Erro ao criar ticket.' });
    }
};

exports.getDashboardTickets = async (req, res) => {
    const user = req.session.user;

    try {
        let sql = '';
        let params = [];
        
        let baseQuery = `
            SELECT t.*, 
                   cat.servico as servico_nome, 
                   cat.sla as sla_estimado,
                   cat.cloud,
                   cat.categoria,
                   cat.sub_categoria,
                   u_cli.nome as cliente_nome, 
                   u_eng.nome as engenheiro_nome 
            FROM tickets_engenharia t
            LEFT JOIN eng_catalog cat ON t.catalog_item_id = cat.id
            LEFT JOIN user u_cli ON t.cliente_id = u_cli.id
            LEFT JOIN user u_eng ON t.engenheiro_id = u_eng.id
        `;

        // --- ALTERAÇÃO AQUI: VISIBILIDADE GERAL ---
        if (user.perfil === 'cliente' || user.perfil === 'user') {
            // Removemos o WHERE t.cliente_id = ?
            // Agora traz TUDO, ordenado por data
            sql = `${baseQuery} ORDER BY t.data_abertura DESC`;
            params = []; // Sem parâmetros de filtro

        } else if (user.perfil === 'engenharia' || user.perfil === 'admin' || user.perfil === 'gerente') {
            if (user.perfil === 'admin') {
                 sql = `${baseQuery} ORDER BY t.id DESC`;
            } else {
                // Engenharia vê tickets dele ou sem dono (ou pode ver tudo tbm, se quiser alterar aqui)
                sql = `${baseQuery} WHERE t.engenheiro_id = ? OR t.engenheiro_id IS NULL ORDER BY t.status ASC`;
                params = [user.id];
            }
        } else {
            return res.status(403).json({ message: 'Perfil não autorizado.' });
        }

        const [tickets] = await pool.query(sql, params);
        res.status(200).json(tickets);

    } catch (error) {
        console.error("Erro ao buscar tickets:", error);
        res.status(500).json({ message: 'Erro ao carregar dashboard.' });
    }
};

exports.updateTicketStatus = async (req, res) => {
    const { id } = req.params;
    
    // FormData envia tudo como string, então tratamos aqui
    const { 
        status, 
        engenheiro_id, 
        comentario_tecnico,
        tipo_solicitacao,
        ambiente,
        catalog_item_id,
        prioridade,
        descricao,
        remove_anexo // Vem como string "0" ou "1"
    } = req.body;

    const loggedUserId = req.session.user.id;

    try {
        const [check] = await pool.query('SELECT id, engenheiro_id, anexo_path FROM tickets_engenharia WHERE id = ?', [id]);
        if (check.length === 0) return res.status(404).json({ message: 'Ticket não encontrado.' });
        
        let targetEngId = engenheiro_id || check[0].engenheiro_id || loggedUserId;
        // Se vier string vazia do front, converte pra null ou mantém o atual? Vamos manter null se vazio.
        if (targetEngId === "") targetEngId = null;

        // Lógica de Anexo
        let newAnexoPath = check[0].anexo_path; // Mantém o atual por padrão
        
        if (remove_anexo === '1') {
            newAnexoPath = null; // Remove se solicitado
        }
        
        if (req.file) {
            newAnexoPath = req.file.path; // Substitui se vier novo arquivo
        }

        let sql = `
            UPDATE tickets_engenharia SET 
                status = ?, 
                engenheiro_id = ?, 
                comentario_tecnico = ?,
                tipo_solicitacao = ?,
                ambiente = ?,
                catalog_item_id = ?,
                prioridade = ?,
                descricao = ?,
                anexo_path = ?
        `;
        
        let params = [
            status, 
            targetEngId, 
            comentario_tecnico,
            tipo_solicitacao,
            ambiente,
            catalog_item_id,
            prioridade,
            descricao,
            newAnexoPath
        ];

        if (status === 'Resolvido') {
            sql += `, data_resolucao = NOW()`;
        }

        sql += ` WHERE id = ?`;
        params.push(id);

        await pool.query(sql, params);

        res.status(200).json({ message: 'Ticket atualizado com sucesso!' });

    } catch (error) {
        console.error("Erro ao atualizar ticket:", error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
exports.resolveTicket = async (req, res) => {
    const { id } = req.params;
    const { status, resolucao_descricao } = req.body;
    const engenheiro_id = req.session.user.id;

    let sql = `UPDATE tickets_engenharia SET status = ?, resolucao_descricao = ?, engenheiro_id = ?`;
    let params = [status, resolucao_descricao, engenheiro_id];

    if (status === 'Resolvido') {
        sql += `, data_resolucao = NOW()`;
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    try {
        await pool.query(sql, params);
        res.json({ message: 'Ticket atualizado.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar.' });
    }
};
exports.getCatalogOptions = async (req, res) => {
    const { cloud, categoria, sub_categoria } = req.query;

    try {
        let query = '';
        let params = [];

        if (!cloud) {
            return res.json(['Amazon', 'Microsoft', 'Google', 'Oracle']);
        } 
        
        if (cloud && !categoria) {
            query = 'SELECT DISTINCT categoria FROM eng_catalog WHERE cloud = ? ORDER BY categoria';
            params = [cloud];
        } 
        else if (cloud && categoria && !sub_categoria) {
            query = 'SELECT DISTINCT sub_categoria FROM eng_catalog WHERE cloud = ? AND categoria = ? ORDER BY sub_categoria';
            params = [cloud, categoria];
        } 
        else if (cloud && categoria && sub_categoria) {
            query = 'SELECT id, servico, sla FROM eng_catalog WHERE cloud = ? AND categoria = ? AND sub_categoria = ? ORDER BY servico';
            params = [cloud, categoria, sub_categoria];
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar catálogo' });
    }
};
exports.getEngineersList = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT id, nome, sobre FROM user WHERE perfil = 'engenharia' OR perfil = 'admin' ORDER BY nome ASC");
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar engenheiros.' });
    }
};