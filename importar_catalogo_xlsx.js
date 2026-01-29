const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do Banco de Dados
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

async function importExcelData() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const workbook = new ExcelJS.Workbook();

        console.log("📂 Lendo arquivo Excel: 'OCI - Cloud Service Catalog.xlsx'...");
        
        try {
            await workbook.xlsx.readFile('OCI - Cloud Service Catalog.xlsx');
        } catch (readErr) {
            console.error("❌ Erro fatal ao ler o arquivo. Verifique se ele existe na pasta.");
            throw readErr;
        }

        // --- CORREÇÃO AQUI: Verifica se existem abas ---
        if (workbook.worksheets.length === 0) {
            console.error("❌ ERRO: Nenhuma aba encontrada no arquivo.");
            console.error("DICA: Se você apenas renomeou um .csv para .xlsx, isso não funciona. Abra o CSV no Excel e vá em 'Salvar Como' -> .xlsx");
            return;
        }

        // Pega a primeira aba disponível (mais seguro que getWorksheet(1))
        const worksheet = workbook.worksheets[0];
        console.log(`✅ Planilha carregada: "${worksheet.name}" com ${worksheet.rowCount} linhas.`);
        
        const results = [];
        let lastCategory = '';
        let lastSubCategory = '';

        console.log("⚙️  Processando linhas...");

        // Itera sobre todas as linhas da planilha
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            // Ignora cabeçalho (ajuste o número 13 se necessário, mas vamos garantir que não pegue lixo)
            if (rowNumber < 10) return; 

            // Tenta pegar os valores de forma segura
            const getVal = (idx) => {
                const cell = row.getCell(idx);
                const val = cell.value;
                if (!val) return null;
                // Se for objeto (hyperlink ou rich text), converte
                if (typeof val === 'object') {
                    if (val.text) return val.text;
                    if (val.result) return val.result;
                    return JSON.stringify(val);
                }
                return val.toString().trim();
            };

            let categoriaVal = getVal(2);     // Coluna B
            let subCategoriaVal = getVal(3);  // Coluna C
            let servicoVal = getVal(4);       // Coluna D
            let slaVal = getVal(5);           // Coluna E

            // Se a linha estiver totalmente vazia nas colunas chave, pula
            if (!categoriaVal && !subCategoriaVal && !servicoVal) return;

            // --- LÓGICA DE HIERARQUIA (Preencher Vazios) ---
            if (categoriaVal) {
                lastCategory = categoriaVal;
                // Quando muda categoria, a subcategoria anterior não vale mais
                // A menos que a planilha repita a estrutura visualmente na mesma linha
            }

            if (subCategoriaVal) {
                lastSubCategory = subCategoriaVal;
            }

            // Validamos se é uma linha de serviço válida
            // Deve ter um nome de serviço E ter herdado (ou ter) uma categoria
            if (servicoVal && lastCategory) {
                // Remove quebras de linha que possam vir do Excel
                const servicoLimpo = servicoVal.replace(/(\r\n|\n|\r)/gm, " ");
                
                results.push([
                    'Oracle',          
                    lastCategory,      
                    lastSubCategory || 'Geral', // Fallback se não tiver subcategoria
                    servicoLimpo,        
                    slaVal || 'N/A'    
                ]);
            }
        });

        console.log(`✅ Encontrados ${results.length} serviços válidos para importar.`);

        if (results.length > 0) {
            // Limpa dados anteriores da Oracle
            await connection.query("DELETE FROM eng_catalog WHERE cloud = 'Oracle'");

            const sql = "INSERT INTO eng_catalog (cloud, categoria, sub_categoria, servico, sla) VALUES ?";
            await connection.query(sql, [results]);
            
            console.log("🚀 Importação concluída com sucesso no Banco de Dados!");
        } else {
            console.log("⚠️  Nenhum dado encontrado. Verifique se as colunas B, C, D, E contêm os dados esperados.");
        }

    } catch (err) {
        console.error("❌ Erro no processo:", err);
    } finally {
        if (connection) await connection.end();
    }
}

importExcelData();