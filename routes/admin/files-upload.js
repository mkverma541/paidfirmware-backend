const express = require('express');
const router = express.Router();
const upload = require('../../config/fileUpload');

const FilesController = require('../../controllers/admin/file-upload');

router
    .route('/upload')
    .post(upload.files(FilesController.expectedFiles()), FilesController.uploadFiles)

module.exports = router;
