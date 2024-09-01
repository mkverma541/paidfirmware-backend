var express = require('express');
var router = express.Router();

const ExcelJSONController = require('../controllers/utils/excelToJSONCoverter');

router.get('/converter/excel/json', ExcelJSONController.convert);
router.get('/converter/json/excel', ExcelJSONController.jsonToExcel);

module.exports = router;
 