var express = require("express");
var router = express.Router();

const SurveyLinkController  = require("../controllers/surveyLinks");

router.post("/", SurveyLinkController.getSurveyLinks);



module.exports = router;
