module.exports = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
  }
};