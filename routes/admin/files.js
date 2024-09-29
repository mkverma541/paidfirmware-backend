const express = require('express');
const router = express.Router();
const upload = require('../../config/fileUpload');
const authenticateToken = require('../../middlewars/authenticateToken');

const FilesController = require('../controllers/files');
const digitalFilesController = require('../controllers/digitalFiles');
const googleDriveFileController = require('../controllers/fileController');
const authenticate = require('../../middlewars/authenticateToken');


router.get('/', digitalFilesController.getAllFolders);
router.get('/files/recent', digitalFilesController.recentFiles);
router.get('/files', digitalFilesController.getList);
router.get('/files/:fileId/generate-link',  digitalFilesController.generateDownloadLink);
router.get('/file/download', digitalFilesController.downloadFile);
router.get('/file/:fileId', digitalFilesController.getFileByFileId);

router.get('/download/:fileId', googleDriveFileController.downloadFile);

router
    .route('/admin/upload/files')
    .post(upload.files(FilesController.expectedFiles()), FilesController.uploadFiles)

router.get('/admin/folders', digitalFilesController.getAllFolders);


router.post('/admin/folder/add', digitalFilesController.addFolder);
router.delete('/admin/folder/delete/:folderId', digitalFilesController.deleteFolder);
router.put('/admin/folder/update/:folderId', digitalFilesController.updateFolder);
router.get('/admin/folder/files', digitalFilesController.getAllFiles);
router.delete('/admin/folder/file/delete/:fileId', digitalFilesController.deleteFile);
router.post('/admin/file/add', digitalFilesController.addFile);
router.put('/admin/file/update/:fileId', digitalFilesController.updateFile);
router.get('/admin/folder/file/:fileId', digitalFilesController.getFileByFileId);
router.post('/admin/file/move', digitalFilesController.cutAndCopyFile);




module.exports = router;