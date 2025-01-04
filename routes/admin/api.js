var express = require('express');
var router = express.Router();
const TelegramController = require('../../controllers/admin/telegram');

router.post('/send-order-details', TelegramController.sendOrderDetailsToTelegram);



module.exports = router;
