const db = require('../config/db'); 


exports.createCompany = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'O nome da empresa é obrigatório.' });
    }
    try {
        const [result] = await db.query('INSERT INTO companies (name) VALUES (?)', [name]);
        res.status(201).json({ message: 'Empresa cadastrada com sucesso!', companyId: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: 'Essa empresa já está cadastrada.' });
        }
        console.error("Erro ao criar empresa:", error);
        res.status(500).json({ message: 'Erro no servidor ao cadastrar empresa.' });
    }
};

exports.getAllCompanies = async (req, res) => {
    try {
        const [companies] = await db.query('SELECT id, name FROM companies ORDER BY name ASC');
        res.status(200).json(companies);
    } catch (error) {
        console.error("Erro ao buscar empresas:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar empresas.' });
    }
};