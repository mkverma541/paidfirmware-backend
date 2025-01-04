var express = require('express');
var router = express.Router();

const WalletController = require('../../controllers/admin/wallet');

router.post('/add', WalletController.addWallet);

module.exports = router;
 
