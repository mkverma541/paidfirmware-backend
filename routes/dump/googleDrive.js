// routes/fileRoutes.js
const express = require('express');
const fileController = require('../controllers/googleDrive');

const router = express.Router();

router.get('/download/:fileId', fileController.downloadFile);

module.exports = router;
