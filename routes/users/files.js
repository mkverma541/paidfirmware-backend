const express = require("express");
const router = express.Router();

const digitalFilesController = require("../../controllers/user/digitalFiles");
const authenticateUser = require('../../middlewars/authenticateToken');

router.get("/folders/path/:folderId", digitalFilesController.getFolderPath);
router.get("/file/path/:fileId", digitalFilesController.getFolderPathByFile);
router.get("/folder/description/:folderId", digitalFilesController.getFolderDescription);

router.get("/folders", digitalFilesController.getAllFolders);
router.get("/files", digitalFilesController.getList);
router.get("/file/:fileId",  digitalFilesController.getFileByFileId);

router.get(
  "/file/generate-download-link/:fileId", authenticateUser,
  digitalFilesController.generateDownloadLink
);
router.get("/file/download/link",  digitalFilesController.downloadFile);

router.get("/files/recent", digitalFilesController.recentFiles);
router.get("/files/paid", digitalFilesController.paidFiles);



module.exports = router;
