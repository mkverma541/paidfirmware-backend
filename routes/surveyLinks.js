var express = require("express");
var router = express.Router();

const SurveyLinkController  = require("../controllers/surveyLinks");

router.post("/", SurveyLinkController.getSurveyLinks);
router.post("/redirect", SurveyLinkController.getRedirectLinks);
router.post("/test", SurveyLinkController.testSurveyLinks);



module.exports = router;
