module.exports = (req, res, next) => {
    const perfil = req.session.user?.perfil;
    if (perfil === 'admin' || perfil === 'support') {
        return next();
    }
    return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
};