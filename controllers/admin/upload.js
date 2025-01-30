const AWS = require("aws-sdk");
const path = require("path");
const multer = require("multer");
require("dotenv").config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

const s3 = new AWS.S3();

// Initialize Multipart Upload
const initiateMultipartUpload = async (fileName, mimeType) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
    ContentType: mimeType,
  };
  return s3.createMultipartUpload(params).promise();
};

// Upload a Part
const uploadPart = async (uploadId, fileName, partNumber, chunk) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
    PartNumber: partNumber,
    UploadId: uploadId,
    Body: chunk,
  };
  return s3.uploadPart(params).promise();
};

// Complete Multipart Upload
const completeMultipartUpload = async (uploadId, fileName, parts) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  };
  return s3.completeMultipartUpload(params).promise();
};

// Abort Multipart Upload
const abortMultipartUpload = async (uploadId, fileName) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
    UploadId: uploadId,
  };
  return s3.abortMultipartUpload(params).promise();
};

// Chunked Upload Controller
const chunkUpload = async (req, res) => {
  try {
    const { fileName, mimeType, uploadId, partNumber, totalParts } = req.body;
    const chunk = req.file.buffer;

    if (!fileName || !mimeType || !partNumber || !chunk || !totalParts) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // If it's the first chunk, initiate a multipart upload
    let uploadResponse;
    if (partNumber === 1) {
      const initiateResponse = await initiateMultipartUpload(fileName, mimeType);
      uploadResponse = { uploadId: initiateResponse.UploadId };
    } else {
      uploadResponse = { uploadId };
    }

    // Upload the chunk
    const uploadPartResponse = await uploadPart(
      uploadResponse.uploadId,
      fileName,
      partNumber,
      chunk
    );  

    // If it's the last part, complete the upload
    if (partNumber === totalParts) {
      const partsArray = [...Array(totalParts).keys()].map((_, index) => ({
        ETag: uploadPartResponse.ETag,
        PartNumber: index + 1,
      }));

      await completeMultipartUpload(uploadResponse.uploadId, fileName, partsArray);
      return res.status(200).json({ message: "Upload complete" });
    }

    // Return the upload ID for subsequent chunks
    res.status(200).json({
      uploadId: uploadResponse.uploadId,
      message: "Chunk uploaded successfully",
    });
  } catch (error) {
    // Abort upload in case of an error
    if (req.body.uploadId) {
      await abortMultipartUpload(req.body.uploadId, req.body.fileName);
    }
    res.status(500).json({ error: "Failed to upload chunk", details: error.message });
  }
};



// Upload video
const uploadVideo = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res
        .status(400)
        .json({ error: "File upload failed", details: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = Date.now() + path.extname(req.file.originalname);

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `videos/${fileName}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    try {
      const data = await s3.upload(params).promise();
      res.status(200).json({ message: "Video uploaded successfully", url: data.Location });
    } catch (uploadError) {
      res
        .status(500)
        .json({ error: "Failed to upload to S3", details: uploadError.message });
    }
  });
};

// Generate pre-signed URL
const generatePreSignedUrl = async (req, res) => {
  const { fileName } = req.query;

  if (!fileName) {
    return res.status(400).json({ error: "fileName is required" });
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
    Expires: 60 * 5,
  };

  try {
    const url = await s3.getSignedUrlPromise("getObject", params);
    res.status(200).json({ url });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to generate pre-signed URL", details: error.message });
  }
};

// List videos
const listVideos = async (req, res) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Prefix: "videos/",
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const videoList = data.Contents.map((item) => ({
      key: item.Key,
      lastModified: item.LastModified,
      size: item.Size,
    }));
    res.status(200).json({ videos: videoList });
  } catch (error) {
    res.status(500).json({ error: "Failed to list videos", details: error.message });
  }
};

// Delete video
const deleteVideo = async (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: "fileName is required" });
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
  };

  try {
    await s3.deleteObject(params).promise();
    res.status(200).json({ message: "Video deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete video", details: error.message });
  }
};

module.exports = { uploadVideo, generatePreSignedUrl, listVideos, deleteVideo, chunkUpload };
