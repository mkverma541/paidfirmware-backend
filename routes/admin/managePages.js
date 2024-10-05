var express = require('express');
var router = express.Router();

const PageController = require('../../controllers/admin/managePages');

router.get('/', PageController.getPages);
router.get('/:slug', PageController.getPage);
router.put('/update/:id', PageController.updatePage);
router.post('/create', PageController.createPage);
router.delete('/delete/:id', PageController.deletePage);
router.get('/generate-json/:slug', PageController.generateJsonFile);


module.exports = router;
