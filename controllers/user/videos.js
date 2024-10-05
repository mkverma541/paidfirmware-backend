const { pool } = require("../../config/database");

async function getVideos(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM res_videos");

    res.status(200).json({
      data: rows,
      status: "success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      status: "error",
    });
  }
}

module.exports = {
  getVideos,
};
