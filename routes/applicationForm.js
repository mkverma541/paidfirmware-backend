var express = require('express');
var router = express.Router();

const ApplicationFormController = require('../controllers/applicationForm');

router.post('/application/form', ApplicationFormController.form);


module.exports = router;
 