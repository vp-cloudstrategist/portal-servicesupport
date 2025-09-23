module.exports = (req, res, next) => {
    if (req.session.user && req.session.user.perfil === 'support') {
        next();
    } else {
        res.status(403).json({ message: 'Acesso proibido. Recurso disponível apenas para a equipe de suporte.' });
    }
};