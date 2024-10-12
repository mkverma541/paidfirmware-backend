const express = require("express");
const router = express.Router();

const authenticateToken = require("../../middlewars/authenticateToken");

const FilesController = require("../../controllers/admin/files");

router.get("/folders", FilesController.getAllFolders);
router.get("/files", FilesController.getList);
router.get(
  "/files/:fileId/generate-link",
  FilesController.generateDownloadLink
);
router.get("/file/download", FilesController.downloadFile);
router.get("/file/:fileId", FilesController.getFileByFileId);

router.get("/folders", FilesController.getAllFolders);

router.post("/folder/add", FilesController.addFolder);
router.delete("/folder/delete/:folderId", FilesController.deleteFolder);
router.put("/folder/update/:folderId", FilesController.updateFolder);
router.get("/folder/files", FilesController.getAllFiles);
router.delete("/folder/file/delete/:fileId", FilesController.deleteFile);
router.post("/file/add", FilesController.addFile);
router.put("/file/update/:fileId", FilesController.updateFile);
router.get("/folder/file/:fileId", FilesController.getFileByFileId);
router.post("/file/move", FilesController.cutAndCopyFile);

module.exports = router;
