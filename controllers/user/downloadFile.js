const express = require("express");
const { pool, secretKey } = require("../../config/database");
const axios = require("axios");
const crypto = require("crypto");

function getUserFingerprint(req) {
  const userAgent = req.headers["user-agent"] || "";
  const acceptLanguage = req.headers["accept-language"] || "";
  const ipAddress =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  const rawFingerprint = `${userAgent}-${acceptLanguage}-${ipAddress}`;
  const fullHash = crypto
    .createHash("sha256")
    .update(rawFingerprint)
    .digest("hex");

  // 32 characters long hash
  const fingerprint = fullHash.substring(0, 32);
  return fingerprint;
}

async function downloadFeaturedFile(req, res) {
  const userId = req.user?.id;
  const { file_id } = req.query;

  try {
    // Step 1: Validate file
    const [fileRows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [file_id]
    );
    if (fileRows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "File not found" });
    }

    const file = fileRows[0];
    const isFreeOrFeatured =
      file.is_featured === 1 || parseFloat(file.price) === 0;

    if (!isFreeOrFeatured) {
      return res.status(400).json({
        status: "error",
        message: "File is not featured. Please purchase it first.",
      });
    }

    // Step 2: Get user packages
    const [userPackages] = await pool.execute(
      "SELECT * FROM res_upackages WHERE user_id = ?",
      [userId]
    );

    if (userPackages.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "You don't have a valid package. Please purchase one.",
      });
    }

    const now = new Date();
    const activePackages = userPackages.filter(
      (pkg) => new Date(pkg.date_expire) > now
    );

    if (activePackages.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Your package has expired. Please purchase a new one.",
      });
    }

    // Step 3: Determine current package, or set the first valid one
    let currentPackage = activePackages.find((pkg) => pkg.is_current === 1);

    if (!currentPackage) {
      currentPackage = activePackages[0];

      // Mark this package as current in DB
      await pool.execute(
        "UPDATE res_upackages SET is_current = 1 WHERE upackage_id = ?",
        [currentPackage.upackage_id]
      );

      // Unset others as current (optional for cleanup)
      await pool.execute(
        "UPDATE res_upackages SET is_current = 0 WHERE user_id = ? AND upackage_id != ?",
        [userId, currentPackage.upackage_id]
      );

      console.log("Auto-selected current package:", currentPackage.upackage_id);
    }

    // Step 4: Check bandwidth + file usage
    const [downloads] = await pool.execute(
      "SELECT * FROM res_udownloads WHERE user_id = ? AND upackage_id = ?",
      [userId, currentPackage.upackage_id]
    );

    const today = new Date().setHours(0, 0, 0, 0);

    const usage = downloads.reduce(
      (acc, d) => {
        const size = parseFloat(d.file_size);
        acc.totalBandwidth += size;

        const dDate = new Date(d.created_at).setHours(0, 0, 0, 0);
        if (dDate === today) {
          acc.todayBandwidth += size;
          acc.todayFiles += 1;
        }
        return acc;
      },
      { totalBandwidth: 0, todayBandwidth: 0, todayFiles: 0 }
    );

    if (usage.totalBandwidth > currentPackage.bandwidth) {
      return res.status(400).json({
        status: "error",
        message:
          "You have used all your bandwidth. Please upgrade your package.",
      });
    }

    if (usage.todayBandwidth >= currentPackage.fair) {
      return res.status(400).json({
        status: "error",
        message: "You have reached your daily bandwidth limit.",
      });
    }

    if (usage.todayFiles >= currentPackage.fair_files) {
      return res.status(400).json({
        status: "error",
        message: "You have reached your daily file download limit.",
      });
    }

    console.log("currentPackage", currentPackage);
    
    // Step 5: Device fingerprint check
    const deviceFingerprint = getUserFingerprint(req);
    const deviceData = currentPackage.devices_fp ? JSON.parse(currentPackage.devices_fp) : { hashes: [], ips: [] };
    const deviceHashes = Array.isArray(deviceData.hashes)
      ? deviceData.hashes
      : [];

    const cleanedHashes = deviceHashes.map((d) => d.trim().toLowerCase());
    const currentFp = deviceFingerprint.trim().toLowerCase();
    const isTrustedDevice = cleanedHashes.includes(currentFp);

    if (!isTrustedDevice) {
      if (deviceHashes.length >= currentPackage.devices) {
        return res.status(400).json({
          status: "error",
          message:
            "You have reached your device limit. Please upgrade your package.",
        });
      }

      // Device not trusted, but limit not reached -> show trust modal
      return res.status(200).json({
        status: "success",
        isShowTrustModal: true,
        totalUsedDevices: deviceHashes.length,
        totalAllowedDevices: currentPackage.devices,
        ipAddress: req.ip,
        deviceFingerprint: currentFp,
      });
    }

    // Step 6: Generate secure download link
    const token = await generateDownloadLink(
      userId,
      file_id,
      req,
      currentPackage.upackage_id,
      null
    );

    return res.status(200).json({
      status: "success",
      link: `${process.env.APP_BASE_URL}/download?token=${token}`,
    });
  } catch (err) {
    console.error("Download error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

async function downloadFreeFile(req, res) {
  const { file_id } = req.query;

  const userId = req.user?.id; // ✅ Get user ID from authenticated request

  try {
    // Step 1: Validate file
    const [fileRows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [file_id]
    );

    if (fileRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    const file = fileRows[0];
    const isFreeOrFeatured =
      file.is_featured === 1 || parseFloat(file.price) === 0;

    if (!isFreeOrFeatured) {
      return res.status(400).json({
        status: "error",
        message: "File is not free. Please purchase it first.",
      });
    }

    const token = await generateDownloadLink(userId, file_id, req, null, null);

    return res.status(200).json({
      status: "success",
      link: `${process.env.APP_BASE_URL}/download?token=${token}`,
    });
  } catch (err) {
    console.error("Download error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

async function downloadPaidFile(req, res) {
  const userId = req.user?.id;
  const { file_id, order_id } = req.query;

  if (!file_id || !order_id) {
    return res.status(400).json({
      status: "error",
      message: "Missing file_id or order_id",
    });
  }

  try {
    // Step 1: Verify that user purchased this file
    const [filesRow] = await pool.execute(
      "SELECT * FROM res_ufiles WHERE file_id = ? AND order_id = ? AND user_id = ?",
      [file_id, order_id, userId]
    );

    if (filesRow.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or not purchased",
      });
    }

    // Step 2: Check if a download token already exists
    const [downloadRows] = await pool.execute(
      "SELECT * FROM res_udownloads WHERE file_id = ? AND order_id = ? AND user_id = ?",
      [file_id, order_id, userId]
    );

    if (downloadRows.length === 0) {
      // No token yet — generate a fresh one
      const token = await generateDownloadLink(
        userId,
        file_id,
        req,
        null,
        order_id
      );

      return res.status(200).json({
        status: "success",
        link: `${process.env.APP_BASE_URL}/download?token=${token}`,
      });
    } else {
      // Token exists — check expiration
      const download = downloadRows[0];
      const expiredAt = new Date(download.expired_at).getTime();

      if (expiredAt < Date.now()) {
        return res.status(400).json({
          status: "error",
          message: "Download link has expired",
        });
      }

      return res.status(200).json({
        status: "success",
        link: `${process.env.APP_BASE_URL}/download?token=${download.hash_token}`,
      });
    }
  } catch (err) {
    console.error("Download error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

async function generateDownloadLink(
  userId,
  fileId,
  req,
  packageId = null,
  orderId = null
) {
  try {
    // 1. Validate that the file exists
    const [fileRows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [fileId]
    );

    const file = fileRows[0];

    if (fileRows.length === 0) {
      throw new Error("File not found");
    }

    // 2. Check if a previous download record exists
    const [existingDownloads] = await pool.execute(
      `SELECT * FROM res_udownloads 
       WHERE user_id = ? AND file_id = ? 
       ORDER BY created_at DESC`,
      [userId, fileId]
    );

    const latestDownload = existingDownloads[0];

    if (latestDownload) {
      const isLinkStillValid =
        new Date(latestDownload.expired_at).getTime() > Date.now();

      if (isLinkStillValid) {
        console.log("Download link is still valid.");
        return latestDownload.hash_token;
      }

      console.log("Previous link expired. Generating a new one.");
    } else {
      console.log("No previous download found. Generating a new link.");
    }

    const DOWNLOAD_LINK_EXPIRY_HOURS =
      process.env.DOWNLOAD_LINK_EXPIRY_HOURS || 24;

    // 3. Generate new token and expiration date
    const newToken = crypto.randomBytes(12).toString("hex");
    const expirationDate = new Date(
      Date.now() + DOWNLOAD_LINK_EXPIRY_HOURS * 60 * 60 * 1000
    );

    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // 4. Insert new download record
    await pool.execute(
      `INSERT INTO res_udownloads 
        (user_id, file_id, upackage_id, order_id, file_title, file_size, download_url, file_url, url_type, ip_address, hash_token, expired_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        fileId,
        packageId,
        orderId,
        file.title,
        file.size,
        null,
        file.url,
        file.url_type,
        ipAddress,
        newToken,
        expirationDate,
      ]
    );

    console.log("New download link generated.");
    return newToken;
  } catch (error) {
    console.error("Error generating download link:", error.message);
    throw new Error("Failed to generate download link");
  }
}
async function downloadFile(req, res) {
  try {
    const token = req.query.token;
    const userId = req.user?.id; // ✅ Get user ID from authenticated request

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "No download token provided",
      });
    }

    // 1. Fetch token details from DB
    const [tokenRows] = await pool.execute(
      "SELECT * FROM res_udownloads WHERE hash_token = ?",
      [token]
    );

    if (tokenRows.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired download link",
      });
    }

    const downloadRecord = tokenRows[0];

    // 2. Check if token is expired
    const expiredAt = new Date(downloadRecord.expired_at).getTime();
    if (expiredAt < Date.now()) {
      return res.status(400).json({
        status: "error",
        message: "Download link has expired",
      });
    }

    // 3. Ensure the same user is downloading
    if (userId !== downloadRecord.user_id) {
      return res.status(403).json({
        status: "error",
        message: "This download link does not belong to your account",
      });
    }

    // 4. Get the file info
    const [fileRows] = await pool.execute(
      "SELECT * FROM res_files WHERE file_id = ?",
      [downloadRecord.file_id]
    );

    if (fileRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found",
      });
    }

    const file = fileRows[0];

    // 5. Update file download count
    await pool.execute(
      "UPDATE res_files SET downloads = downloads + 1 WHERE file_id = ?",
      [file.file_id]
    );

    // 6. Return the file download URL
    return res.status(200).json({
      status: "success",
      link: file.url,
    });
  } catch (error) {
    console.error("Download error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

async function trustDevice(req, res) {
  try {
    const userId = req.user?.id;
    const { deviceFingerprint, ipAddress } = req.body;

    if (!userId || !deviceFingerprint || !ipAddress) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    // Fetch user's current active package
    const [packages] = await pool.execute(
      "SELECT * FROM res_upackages WHERE user_id = ? AND is_current = 1",
      [userId]
    );

    if (packages.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No active package found. Please purchase a package.",
      });
    }

    let currentPackage = packages[0];
    const deviceData = JSON.parse(currentPackage.devices_fp || "{}");

    const deviceHashes = Array.isArray(deviceData.hashes) ? deviceData.hashes : [];
    const deviceIps = Array.isArray(deviceData.ips) ? deviceData.ips : [];

    const cleanedFingerprint = deviceFingerprint.trim().toLowerCase();
    const cleanedHashes = deviceHashes.map((d) => d.trim().toLowerCase());

    if (cleanedHashes.includes(cleanedFingerprint)) {
      return res.status(200).json({
        status: "success",
        message: "Device is already trusted",
      });
    }

    if (deviceHashes.length >= currentPackage.devices) {
      return res.status(400).json({
        status: "error",
        message: "Device limit reached for this package.",
      });
    }

    // Add device and update DB
    const updatedHashes = [...deviceHashes, cleanedFingerprint];
    const updatedIps = Array.from(new Set([...deviceIps, ipAddress]));

    await pool.execute(
      "UPDATE res_upackages SET devices_fp = ? WHERE upackage_id = ?",
      [
        JSON.stringify({ hashes: updatedHashes, ips: updatedIps }),
        currentPackage.upackage_id,
      ]
    );

    return res.status(200).json({
      status: "success",
      message: "Device successfully added as trusted.",
    });
  } catch (error) {
    console.error("Error trusting device:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}


module.exports = {
  generateDownloadLink,
  downloadFile,
  downloadFeaturedFile,
  downloadFreeFile,
  downloadPaidFile,
  trustDevice,
};
