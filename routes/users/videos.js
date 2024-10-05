const express = require('express');
const router = express.Router();
const VideosController = require('../../controllers/user/videos');

router.get('/', VideosController.getVideos);



module.exports = router;
