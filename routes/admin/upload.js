var express = require("express");
var router = express.Router();

const uploadController = require("../../controllers/admin/upload");

// Route for uploading a video
router.post("/video", uploadController.uploadVideo);

router.post("/video/chunk", uploadController.chunkUpload);

// Route for generating a pre-signed URL for a video
router.get("/video", uploadController.generatePreSignedUrl);

// Route for listing videos
router.get("/videos", uploadController.listVideos);

// Route for deleting a video
router.delete("/video", uploadController.deleteVideo);

module.exports = router;
