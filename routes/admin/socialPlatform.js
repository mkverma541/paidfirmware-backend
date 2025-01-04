var express = require('express');
var router = express.Router();
const SocialPlatform = require('../../controllers/admin/socialPlatform');

router.post('/create', SocialPlatform.createSocialPlatform);
router.get('/', SocialPlatform.getSocialPlatforms);
router.delete('/delete/:id', SocialPlatform.deleteSocialPlatform);
router.put('/update/:id', SocialPlatform.updateSocialPlatform);

module.exports = router;
