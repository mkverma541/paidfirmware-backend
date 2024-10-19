const express = require('express');
const router = express.Router();

const SiteOptionsController = require('../../controllers/admin/siteOptions');

router.get('/', SiteOptionsController.getAllOptions);
router.put('/update', SiteOptionsController.updateOption);
router.post('/add', SiteOptionsController.addOption);


module.exports = router;
