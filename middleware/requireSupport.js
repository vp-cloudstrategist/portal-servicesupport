module.exports = (req, res, next) => {
    if (req.session.user && req.session.user.perfil === 'support') {
        // Se o usuário está na sessão E o perfil dele é 'support', pode passar.
        next();
    } else {
        // Se não, retorna um erro de "Proibido".
        res.status(403).json({ message: 'Acesso proibido. Recurso disponível apenas para a equipe de suporte.' });
    }
};