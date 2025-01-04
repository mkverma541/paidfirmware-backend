const express = require("express");
const router = express.Router();

const digitalFilesController = require("../../controllers/user/digitalFiles");
const authenticateUser = require('../../middlewars/authenticateToken');

// shared files

router.get("/folders", digitalFilesController.getAllFoldersFiles);
router.get("/folders/:slug", digitalFilesController.getFolderAndFiles);
router.get("/folders/path/:slug", digitalFilesController.getFolderPath);
router.get("/folder/description/:slug", digitalFilesController.getFolderDescription);

router.get("/file/path/:slug", digitalFilesController.getFilePath);
router.get("/file/:slug",  digitalFilesController.getFileByFileSlug);

router.get("/files/recent", digitalFilesController.recentFiles);
router.get("/files/paid", digitalFilesController.paidFiles);

router.get(
  "/file/generate-download-link/:fileId", authenticateUser,
  digitalFilesController.generateDownloadLink
);
router.get("/file/download/link",  digitalFilesController.downloadFile);
router.get('/clear-cache', digitalFilesController.clearAllCache);



module.exports = router;
