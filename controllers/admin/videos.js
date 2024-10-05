const { pool } = require("../../config/database");

// Create a new YouTube video

async function createYouTubeVideo(req, res) {
    const { video_url, thumbnail, title, description, categories = [] } = req.body;

    try {
        const query = `INSERT INTO res_videos (video_url, thumbnail, title, description) VALUES (?, ?, ?, ?)`;
        const [result] = await pool.query(query, [video_url, thumbnail, title, description]);

        const videoId = result.insertId;

        // Insert categories for the video if provided
        if (categories.length > 0) {
            const categoryQuery = `INSERT INTO res_video_categories_relationship (video_id, category_id) VALUES ?`;
            const categoryData = categories.map(categoryId => [videoId, categoryId]);
            await pool.query(categoryQuery, [categoryData]);
        }

        res.status(201).json({ message: "Video created successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}


// Get all YouTube videos
async function getAllYouTubeVideos(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT v.video_id, v.video_url, v.thumbnail, v.title, v.description, GROUP_CONCAT(vc.category_name) AS categories
            FROM res_videos v
            LEFT JOIN res_video_categories_relationship vcr ON v.video_id = vcr.video_id
            LEFT JOIN res_video_categories vc ON vcr.category_id = vc.category_id
            GROUP BY v.video_id
        `);

        res.status(200).json({
            data: rows,
            status: "success",
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Update a YouTube video
async function updateYouTubeVideo(req, res) {
    const { videoId } = req.params; // Expecting videoId as a URL parameter
    const { video_url, thumbnail, title, description } = req.body; // Fields to update

    try {
        const query = `
            UPDATE res_videos 
            SET video_url = ?, thumbnail = ?, title = ?, description = ? 
            WHERE video_id = ?
        `;
        const [result] = await pool.query(query, [video_url, thumbnail, title, description, videoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Video not found", status: "error" });
        }

        res.status(200).json({ message: "Video updated successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Delete a YouTube video
async function deleteYouTubeVideo(req, res) {
    const { videoId } = req.params; // Expecting videoId as a URL parameter

    try {
        const query = `DELETE FROM res_videos WHERE video_id = ?`;
        const [result] = await pool.query(query, [videoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Video not found", status: "error" });
        }

        res.status(200).json({ message: "Video deleted successfully", status: "success" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", status: "error" });
    }
}

// Export the controller functions
module.exports = {
    getAllYouTubeVideos,
    updateYouTubeVideo,
    deleteYouTubeVideo,
    createYouTubeVideo,
};
