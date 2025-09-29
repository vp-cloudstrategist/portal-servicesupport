const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

const requireAdmin = require('../middleware/requireAdmin'); 

router.post('/', requireAdmin, companyController.createCompany);

router.get('/', requireAdmin, companyController.getAllCompanies);

module.exports = router;