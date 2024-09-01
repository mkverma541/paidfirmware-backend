// controllers/fileController.js
const fs = require('fs');
const { google } = require('googleapis');
const authenticate = require('../controllers/authenticate');

const fileController = {
  downloadFile: async (req, res) => {
    const fileId = req.params.fileId;

    try {
      const authClient = await authenticate();
      const drive = google.drive({ version: 'v3', auth: authClient });

      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

      res.setHeader('Content-Type', response.headers['content-type']);
      res.setHeader('Content-Disposition', `attachment; filename=${response.headers['content-disposition'].split('"')[1]}`);

      response.data.pipe(res);
    } catch (err) {
      console.error('Authentication error:', err);
      res.status(500).send('Authentication error');
    }
  },
};

module.exports = fileController;
