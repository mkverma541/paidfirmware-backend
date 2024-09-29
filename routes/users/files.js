const express = require("express");
const router = express.Router();

const digitalFilesController = require("../../controllers/user/digitalFiles");

router.get("/folders", digitalFilesController.getAllFolders);
router.get("/files/recent", digitalFilesController.recentFiles);
router.get("/files/paid", digitalFilesController.paidFiles);
router.get("/files", digitalFilesController.getList);
router.get(
  "/files/:fileId/generate-link",
  digitalFilesController.generateDownloadLink
);
router.get("/file/download", digitalFilesController.downloadFile);
router.get("/file/:fileId", digitalFilesController.getFileByFileId);


module.exports = router;
