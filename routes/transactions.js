var express = require('express');
var router = express.Router();

const TransactionsController = require('../controllers/transactions');

 router.get('/transactions', TransactionsController.transactions);

module.exports = router;
 