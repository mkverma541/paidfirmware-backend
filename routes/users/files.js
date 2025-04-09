const express = require("express");
const router = express.Router();
const digitalFilesController = require("../../controllers/user/digitalFiles");
const downloadFileController = require("../../controllers/user/downloadFile");

const authenticateUser = require("../../middlewars/authenticateToken");
const cacheMiddleware = require("../../middlewars/redis");

router.get("/folders", cacheMiddleware, digitalFilesController.getAllFoldersFiles);
router.get("/folders/:slug", cacheMiddleware, digitalFilesController.getFolderAndFiles);
router.get("/folders/path/:slug", cacheMiddleware, digitalFilesController.getFolderPath);
router.get(
  "/folder/description/:slug",
  cacheMiddleware,
  digitalFilesController.getFolderDescription
);

router.get("/file/path/:slug", cacheMiddleware, digitalFilesController.getFilePath);
router.get("/file/:slug", cacheMiddleware, digitalFilesController.getFileByFileSlug);

router.get("/files/recent", cacheMiddleware, digitalFilesController.recentFiles);
router.get("/files/paid", cacheMiddleware, digitalFilesController.paidFiles);
router.get("/files/free", cacheMiddleware, digitalFilesController.freeFiles);

router.get("/file/stats/:slug", digitalFilesController.getStats);


// downloads files from the file manager
router.get("/file/download/featured", authenticateUser, downloadFileController.downloadFeaturedFile);
router.get("/file/download/free", authenticateUser, downloadFileController.downloadFreeFile);
router.get("/file/download/paid", authenticateUser, downloadFileController.downloadPaidFile);
router.post("/devices/trust", authenticateUser, downloadFileController.trustDevice);

router.get("/file/download/link", authenticateUser, downloadFileController.downloadFile);



module.exports = router;
