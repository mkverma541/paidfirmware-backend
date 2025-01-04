var express = require('express');
var router = express.Router();

const ContactUsEnquiryController = require('../../controllers/user/contactUsEnquiry');

router.post('/contact-us', ContactUsEnquiryController.contactUsEnquiry);

module.exports = router;
 