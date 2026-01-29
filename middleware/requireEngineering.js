module.exports = (req, res, next) => {
    if (req.session && req.session.user && 
       (req.session.user.perfil === 'engenharia' || req.session.user.perfil === 'admin')) {
        return next();
    } else {
        return res.status(403).json({ message: 'Acesso restrito à engenharia.' });
    }
};