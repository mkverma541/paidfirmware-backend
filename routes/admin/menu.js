var express = require('express');
var router = express.Router();

const MenuController = require('../../controllers/admin/menu');

router.get('/', MenuController.getMenus);
router.get('/:id', MenuController.getMenu);
router.post('/create', MenuController.createMenu);
router.put('/update/:id', MenuController.updateMenu);
router.delete('/delete/:id', MenuController.deleteMenu);
router.get('/sync/json', MenuController.generateJsonFile);

module.exports = router;
