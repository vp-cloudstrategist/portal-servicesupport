const pool = require('../config/db.js');
const axios = require('axios');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const TEAMS_WEBHOOK_URL = 'https://default54b06350783c4d98b06e82936dec4b.d3.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5332b5faf95144489f01dbecddd11bc7/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=2bQrMR_bfDyQc9yYqEKYipK2fFgJ73z-X9u0UUhUQx4';

const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

function formatarDataHora() {
    return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

exports.createTicket = async (req, res) => {
    // Pega os dados do formulário e renomeia o cliente_id do body para evitar conflito com a sessão
    const { tipo_solicitacao, ambiente, catalog_item_id, prioridade, descricao, cliente_id: clienteTargetId } = req.body;
    
    // Define os dados padrão como sendo da pessoa que está logada
    let cliente_id = req.session.user.id;
    let cliente_nome = req.session.user.nome;
    let cliente_email = req.session.user.login; // Assumindo que o login é o email
    const perfil_usuario = req.session.user.perfil;

    let anexo_path = null;
    if (req.file) {
        anexo_path = req.file.path;
    }

    try {
        // --- NOVA LÓGICA: ABRIR EM NOME DE UM CLIENTE ---
        // Se enviou um cliente alvo e quem tá logado tem permissão de equipe interna
        if (clienteTargetId && ['admin', 'gerente', 'engenharia'].includes(perfil_usuario)) {
            cliente_id = clienteTargetId; // Sobrescreve o ID do dono do ticket
            
            // Vai no banco buscar o nome e email do cliente selecionado para mandar os avisos pra ele
            const [cliRows] = await pool.query('SELECT nome, sobre, login FROM user WHERE id = ?', [cliente_id]);
            if (cliRows.length > 0) {
                cliente_nome = cliRows[0].nome + (cliRows[0].sobre ? ' ' + cliRows[0].sobre : '');
                cliente_email = cliRows[0].login;
            }
        }
        // ------------------------------------------------

        // 1. Salva o Ticket no Banco (usando a variável cliente_id que agora está dinâmica)
        const sql = `
            INSERT INTO tickets_engenharia 
            (cliente_id, tipo_solicitacao, ambiente, catalog_item_id, prioridade, descricao, anexo_path, status, data_abertura) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())
        `;
        
        const [result] = await pool.query(sql, [
            cliente_id, tipo_solicitacao, ambiente, catalog_item_id, prioridade, descricao, anexo_path
        ]);

        const novoTicketId = result.insertId;

        // 2. Prepara o E-mail (Layout Azul Clean)
        // Buscamos o nome do serviço para ficar bonito no email
        let nomeServico = 'Geral';
        if (catalog_item_id) {
            const [servicoRows] = await pool.query('SELECT servico FROM eng_catalog WHERE id = ?', [catalog_item_id]);
            if (servicoRows.length > 0) nomeServico = servicoRows[0].servico;
        }

        const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                
                <div style="background-color: #3B82F6; padding: 20px; text-align: center;">
                    <img src="https://service.nexxtcloud.app/images/Nexxt-Cloud-Logo-4.png" alt="Nexxt Cloud" style="max-width: 150px; display: block; margin: 0 auto;">
                    <h2 style="color: #fff; margin: 15px 0 0 0; font-weight: 600;">Chamado Aberto</h2>
                </div>

                <div style="padding: 30px; background-color: #ffffff;">
                    <p style="font-size: 16px; margin-bottom: 20px;">Olá,</p>
                    
                    <p style="font-size: 14px; color: #555; line-height: 1.6;">
                        Uma nova solicitação foi registrada com sucesso no Portal de Engenharia.
                    </p>
                    
                    <div style="background-color: #F3F4F6; border-left: 4px solid #3B82F6; padding: 15px; margin: 25px 0; border-radius: 4px;">
                        <p style="margin: 5px 0;"><strong>Ticket:</strong> #${novoTicketId}</p>
                        <p style="margin: 5px 0;"><strong>Solicitante:</strong> ${cliente_nome}</p>
                        <p style="margin: 5px 0;"><strong>Serviço:</strong> ${nomeServico}</p>
                        <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${prioridade}</p>
                        <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 10px 0;">
                        <p style="margin: 5px 0;"><strong>Descrição:</strong><br>${descricao}</p>
                    </div>

                    <p style="font-size: 14px; color: #555; text-align: center; margin-top: 30px;">
                        Nossa equipe já foi notificada e iniciará a análise em breve.
                    </p>
                </div>

                <div style="background-color: #3B82F6; padding: 15px; text-align: center;">
                    <p style="font-size: 12px; color: #fff; margin: 0;">
                        Nexxt Cloud - Engenharia<br>
                        <a href="https://support.nexxtcloud.app" style="color: #fff; text-decoration: none; font-weight: bold;">Acessar Portal</a>
                    </p>
                </div>
            </div>
        `;

        // 3. Envia para o Cliente
        try {
            await transporter.sendMail({
                from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
                to: cliente_email,
                subject: `[Registrado] Solicitação #${novoTicketId} - Nexxt Cloud`,
                html: emailHtml
            });
        } catch (err) {
            console.error("[EMAIL ERROR] Falha ao enviar para cliente:", err);
        }

        // 4. Envia para a Equipe de Engenharia
        try {
            // Busca todos os emails de perfil 'engenharia'
            const [engUsers] = await pool.query("SELECT login FROM user WHERE perfil = 'engenharia'");
            
            if (engUsers.length > 0) {
                // Cria um array de emails (ex: ['eng1@nexxt.com', 'eng2@nexxt.com'])
                const listaEngenharia = engUsers.map(u => u.login);

                await transporter.sendMail({
                    from: `"Portal Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
                    to: listaEngenharia, // O Nodemailer aceita array e envia para todos
                    subject: `[Novo Chamado] #${novoTicketId} - ${prioridade} - ${cliente_nome}`,
                    html: emailHtml
                });
            }
        } catch (err) {
            console.error("[EMAIL ERROR] Falha ao enviar para engenharia:", err);
        }

        // 5. Notificação do Teams
        const fatosAbertura = [
            { name: "ID:", value: `#${novoTicketId}` },
            { name: "Solicitante:", value: cliente_nome },
            { name: "Categoria:", value: tipo_solicitacao }, 
            { name: "Prioridade:", value: prioridade },
            { name: "Descrição:", value: descricao.length > 100 ? descricao.substring(0, 100) + '...' : descricao }, 
            { name: "⏰ Data/Hora:", value: formatarDataHora() }
        ];

       
        enviarNotificacaoTeams("🎫 Ticket ABERTO - 🚨 Novo ticket registrado", fatosAbertura, "A equipe responsável já foi notificada.");

        res.status(201).json({ message: 'Ticket criado com sucesso!', ticketId: novoTicketId });

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
           u_cli.sobre as cliente_sobrenome, /* <--- ADICIONADO */
           u_cli.login as cliente_email,
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
            sql = `${baseQuery} ORDER BY t.status ASC, t.id DESC`;
    params = []; 

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
    
    const { 
        status, 
        engenheiro_id, 
        comentario_tecnico,
        tipo_solicitacao,
        ambiente,
        catalog_item_id,
        prioridade,
        descricao,
        remove_anexo 
    } = req.body;

    const loggedUserId = req.session.user.id;

    try {
        const [check] = await pool.query('SELECT id, status, engenheiro_id, anexo_path FROM tickets_engenharia WHERE id = ?', [id]);
        
        if (check.length === 0) return res.status(404).json({ message: 'Ticket não encontrado.' });
        
        // Trava de segurança para tickets resolvidos
        if (check[0].status === 'Resolvido' && status !== 'Reaberto') {
            return res.status(403).json({ 
                message: 'Ticket resolvido só aceita edição se o status for alterado para "Reaberto".' 
            });
        }

        let targetEngId = engenheiro_id || check[0].engenheiro_id || loggedUserId;
        if (targetEngId === "") targetEngId = null;

        let newAnexoPath = check[0].anexo_path; 
        
        if (remove_anexo === '1') {
            newAnexoPath = null; 
        }
        
        if (req.file) {
            newAnexoPath = req.file.path; 
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

        // --- Lógica de Envio de Notificações (E-mail e Teams) ---
        if (status === 'Resolvido') {
            const [ticketData] = await pool.query(`
                SELECT t.id, t.tipo_solicitacao, t.descricao, t.comentario_tecnico, 
                       u.login as email_cliente, u.nome as nome_cliente,
                       eng.nome as nome_engenheiro
                FROM tickets_engenharia t
                JOIN user u ON t.cliente_id = u.id
                LEFT JOIN user eng ON t.engenheiro_id = eng.id
                WHERE t.id = ?
            `, [id]);

            if (ticketData.length > 0) {
                const info = ticketData[0]; // 'info' é criada aqui
                
                // 1. Envio de E-mail
                const emailHtml = `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #3B82F6; padding: 20px; text-align: center;">
                            <img src="https://service.nexxtcloud.app/images/Nexxt-Cloud-Logo-4.png" alt="Nexxt Cloud" style="max-width: 150px; display: block; margin: 0 auto;">
                            <h2 style="color: #fff; margin: 15px 0 0 0; font-weight: 600;">Solicitação Resolvida</h2>
                        </div>
                        <div style="padding: 30px; background-color: #ffffff;">
                            <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${info.nome_cliente}</strong>,</p>
                            <p style="font-size: 14px; color: #555; line-height: 1.6;">
                                Informamos que sua solicitação <strong>#${info.id}</strong> foi concluída pela nossa equipe de engenharia.
                            </p>
                            <div style="background-color: #F3F4F6; border-left: 4px solid #3B82F6; padding: 15px; margin: 25px 0; border-radius: 4px;">
                                <p style="margin: 5px 0;"><strong>Tipo:</strong> ${info.tipo_solicitacao}</p>
                                <p style="margin: 5px 0;"><strong>Descrição:</strong> ${info.descricao}</p>
                                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 10px 0;">
                                <p style="margin: 5px 0;"><strong>Solução Técnica:</strong><br>${info.comentario_tecnico || 'Resolvido conforme solicitado.'}</p>
                                <p style="margin: 10px 0 0 0; font-size: 12px; color: #6B7280;">Analista responsável: ${info.nome_engenheiro || 'Equipe Nexxt Cloud'}</p>
                            </div>
                            <p style="font-size: 14px; color: #555; text-align: center; margin-top: 30px;">
                                Estamos à disposição caso precise reabrir este ticket ou tirar dúvidas.
                            </p>
                        </div>
                        <div style="background-color: #3B82F6; padding: 15px; text-align: center;">
                            <p style="font-size: 12px; color: #fff; margin: 0;">
                                Nexxt Cloud - Engenharia<br>
                            </p>
                        </div>
                    </div>
                `;

                try {
                    await transporter.sendMail({
                        from: `"Suporte Nexxt Cloud" <${process.env.EMAIL_FROM}>`,
                        to: info.email_cliente,
                        subject: `[Resolvido] Solicitação #${info.id} - Nexxt Cloud`,
                        html: emailHtml
                    });
                } catch (emailErr) {
                    console.error("[EMAIL ERROR] Falha ao enviar notificação de resolução:", emailErr);
                }

       
                const fatosFechamento = [
                    { name: "ID:", value: `#${info.id}` },
                    { name: "Solicitante:", value: info.nome_cliente },
                    { name: "Categoria:", value: info.tipo_solicitacao },
                    { name: "Responsável:", value: info.nome_engenheiro || 'N/A' },
                    { name: "🕒 Data/Hora:", value: formatarDataHora() }
                ];

                enviarNotificacaoTeams("✅ Ticket FECHADO - ✔️ Ticket finalizado", fatosFechamento, "Caso precise de algo adicional, é só abrir um novo ticket. 😉");
            }
        }

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
exports.getClientsList = async (req, res) => {
    try {
        const sql = `
            SELECT id, nome, sobre, login, perfil 
            FROM user 
            WHERE perfil NOT IN ('admin', 'gerente', 'engenharia', 'support') 
            ORDER BY nome ASC
        `;
        
        const [rows] = await pool.query(sql);
        
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar clientes para engenharia:", error);
        res.status(500).json({ message: 'Erro ao buscar clientes.' });
    }
};
exports.getCatalogOptions = async (req, res) => {
    const { cloud, tipo, categoria, sub_categoria } = req.query;

    try {
        let sql = '';
        let params = [];

        if (!cloud) return res.json(['Amazon', 'Microsoft', 'Google', 'Oracle']);
        
        if (cloud && tipo && !categoria && !sub_categoria) {
            sql = "SELECT DISTINCT categoria FROM eng_catalog WHERE cloud = ? AND tipo_solicitacao = ? AND ativo = 1 AND categoria != '' ORDER BY categoria";
            params = [cloud, tipo];
        } 
        else if (cloud && tipo && categoria && !sub_categoria) {
            sql = "SELECT DISTINCT sub_categoria FROM eng_catalog WHERE cloud = ? AND tipo_solicitacao = ? AND categoria = ? AND ativo = 1 AND sub_categoria != '' ORDER BY sub_categoria";
            params = [cloud, tipo, categoria];
        } 
        else if (cloud && tipo && categoria && sub_categoria) {
            sql = "SELECT id, servico, sla FROM eng_catalog WHERE cloud = ? AND tipo_solicitacao = ? AND categoria = ? AND sub_categoria = ? AND ativo = 1 AND servico != '' ORDER BY servico";
            params = [cloud, tipo, categoria, sub_categoria];
        } else {
             return res.status(400).json({ error: 'Parâmetros insuficientes para a busca.' });
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao buscar no eng_catalog:", error);
        res.status(500).json({ error: 'Erro ao buscar catálogo' });
    }
};
exports.crudCatalog = async (req, res) => {
    const { action, level, cloud, tipo, categoria, sub_categoria, id, old_val, new_val, sla } = req.body;

    try {
        if (level === 'categoria') {
            if (action === 'create') await pool.query("INSERT INTO eng_catalog (cloud, tipo_solicitacao, categoria, sub_categoria, servico, sla, ativo) VALUES (?, ?, ?, '', '', '', 1)", [cloud, tipo, new_val]);
            if (action === 'edit') await pool.query("UPDATE eng_catalog SET categoria = ? WHERE cloud = ? AND tipo_solicitacao = ? AND categoria = ?", [new_val, cloud, tipo, old_val]);
            if (action === 'delete') await pool.query("UPDATE eng_catalog SET ativo = 0 WHERE cloud = ? AND tipo_solicitacao = ? AND categoria = ?", [cloud, tipo, old_val]);
        }
        else if (level === 'sub_categoria') {
            if (action === 'create') await pool.query("INSERT INTO eng_catalog (cloud, tipo_solicitacao, categoria, sub_categoria, servico, sla, ativo) VALUES (?, ?, ?, ?, '', '', 1)", [cloud, tipo, categoria, new_val]);
            if (action === 'edit') await pool.query("UPDATE eng_catalog SET sub_categoria = ? WHERE cloud = ? AND tipo_solicitacao = ? AND categoria = ? AND sub_categoria = ?", [new_val, cloud, tipo, categoria, old_val]);
            if (action === 'delete') await pool.query("UPDATE eng_catalog SET ativo = 0 WHERE cloud = ? AND tipo_solicitacao = ? AND categoria = ? AND sub_categoria = ?", [cloud, tipo, categoria, old_val]);
        }
        else if (level === 'servico') {
            if (action === 'create') await pool.query("INSERT INTO eng_catalog (cloud, tipo_solicitacao, categoria, sub_categoria, servico, sla, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)", [cloud, tipo, categoria, sub_categoria, new_val, sla]);
            if (action === 'edit') await pool.query("UPDATE eng_catalog SET servico = ?, sla = ? WHERE id = ?", [new_val, sla, id]);
            if (action === 'delete') await pool.query("UPDATE eng_catalog SET ativo = 0 WHERE id = ?", [id]);
        }

        res.status(200).json({ message: 'Operação realizada com sucesso no catálogo!' });
    } catch (error) {
        console.error("Erro no CRUD Engenharia:", error);
        res.status(500).json({ message: 'Erro ao processar catálogo da engenharia.' });
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
exports.deleteTicket = async (req, res) => {
    const { id } = req.params;
    const user = req.session.user;
    const perfisPermitidos = ['admin', 'gerente', 'engenharia'];
    
    if (!perfisPermitidos.includes(user.perfil)) {
        return res.status(403).json({ message: 'Permissão negada. Apenas Admin, Gerente ou Engenharia podem excluir.' });
    }

    try {

        const [result] = await pool.query('DELETE FROM tickets_engenharia WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ticket não encontrado.' });
        }

        res.status(200).json({ message: 'Solicitação excluída com sucesso!' });

    } catch (error) {
        console.error("Erro ao deletar ticket:", error);
        res.status(500).json({ message: 'Erro interno ao tentar excluir.' });
    }
};
async function enviarNotificacaoTeams(titulo, fatos, textoFinal) {
    if (!TEAMS_WEBHOOK_URL) return;

    try {
        const payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "0076D7",
            "summary": titulo,
            "sections": [{
                "activityTitle": titulo,
                "facts": fatos, 
                "text": textoFinal
            }]
        };

        await axios.post(TEAMS_WEBHOOK_URL, payload);
    } catch (error) {
        console.error("Erro ao enviar notificação para o Teams:", error.message);
    }
}
exports.receiveZabbixWebhook = async (req, res) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${process.env.ZABBIX_WEBHOOK_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
        console.warn("[WEBHOOK] Tentativa bloqueada. Token inválido.");
        return res.status(401).json({ error: 'Acesso negado.' });
    }

    try {
        const payload = req.body;
        console.log(" WEBHOOK N8N/ZABBIX RECEBIDO ", payload);

        let prioridadeTicket = 'Media'; 
        const severidadeZabbix = payload.severity ? payload.severity.toLowerCase() : '';
        
        if (severidadeZabbix.includes('high')) prioridadeTicket = 'Alta';
        if (severidadeZabbix.includes('disaster')) prioridadeTicket = 'Critica';

        const descricaoTicket = payload.description || `Alerta: ${payload.alert_name} no host ${payload.hostname}`;

        const cliente_id = payload.cliente_id || 101; 
        
        const tipo_solicitacao = 'Incidente';
        const ambiente = 'PRODUCAO';
        const catalog_item_id = null; 

        const sql = `
            INSERT INTO tickets_engenharia 
            (cliente_id, tipo_solicitacao, ambiente, catalog_item_id, prioridade, descricao, status, data_abertura) 
            VALUES (?, ?, ?, ?, ?, ?, 'Aberto', NOW())
        `;
        
        const [result] = await pool.query(sql, [
            cliente_id, tipo_solicitacao, ambiente, catalog_item_id, prioridadeTicket, descricaoTicket
        ]);

        console.log(` Ticket Automático Aberto via n8n! ID: #${result.insertId} para o Cliente ID: ${cliente_id}`);

        res.status(201).json({ message: 'Ticket aberto no portal com sucesso!', ticketId: result.insertId });

    } catch (error) {
        console.error("[WEBHOOK] Erro ao abrir ticket:", error);
        
        res.status(500).json({ 
            error: 'Erro interno ao processar webhook.',
            detalhe: error.message,
            erroBanco: error.sqlMessage || 'Nenhum erro SQL específico'
        });
    }
};