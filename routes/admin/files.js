const express = require("express");
const router = express.Router();

const authenticateToken = require("../../middlewars/authenticateToken");
const FilesController = require("../../controllers/admin/files");
const sharedFilesController = require("../../controllers/shared/file");

router.get("/folders", FilesController.getAllFoldersFiles);
router.get(
  "/files/:fileId/generate-link",
  FilesController.generateDownloadLink
);
router.get("/file/download", FilesController.downloadFile);
router.get("/file/:fileId", FilesController.getFileByFileId);
router.get("/files/search", FilesController.searchFilesFolders);
router.get("/files/search/all", FilesController.searchFilesFoldersWithSorting);

router.post("/folder/add", FilesController.addFolder);
router.delete("/folder/delete/:folderId", FilesController.deleteFolder);
router.put("/folder/update/:folderId", FilesController.updateFolder);
router.get("/folder/files", FilesController.getAllFiles);
router.delete("/folder/file/delete/:fileId", FilesController.deleteFile);
router.post("/file/add", FilesController.addFile);
router.put("/file/update/:fileId", FilesController.updateFile);
router.get("/folder/file/:fileId", FilesController.getFileByFileId);
router.post("/file/move", FilesController.cutAndCopyFile);
router.post("/folder/move", FilesController.cutAndCopyFolder);

router.get("/update/slug/folder", FilesController.updateSlugsForFolders);

// shared files

router.get("/folders/path/:folderId", sharedFilesController.getFolderPath);
router.get("/file/path/:fileId", sharedFilesController.getFolderPathByFile);
router.get("/folder/description/:folderId", sharedFilesController.getFolderDescription);



module.exports = router;
