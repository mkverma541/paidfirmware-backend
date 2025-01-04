var express = require('express');
var router = express.Router();

const ContactUsEnquiryController = require('../../controllers/admin/contactUsEnquiry');

router.get('/', ContactUsEnquiryController.getList);
router.post('/contact-us', ContactUsEnquiryController.contactUsEnquiry);

module.exports = router;
 