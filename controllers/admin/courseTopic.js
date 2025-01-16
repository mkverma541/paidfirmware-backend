const { pool } = require("../../config/database");


async function createTopic(req, res) {
  const { topic_name, description, course_id } = req.body;

  if (!course_id) {
    return res
      .status(400)
      .json({ status: "error", message: "Course ID is required." });
  }

  if (!topic_name) {
    return res
      .status(400)
      .json({ status: "error", message: "Topic name is required." });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO res_course_topics (course_id, topic_name, description) VALUES (?, ?, ?)`,
      [course_id, topic_name, description]
    );

    res.status(201).json({
      status: "success",
      message: "Topic added successfully.",
      data: { topic_id: result.insertId, topic_name, description },
    });
  } catch (error) {
    console.error("Error adding topic:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function updateTopic(req, res) {
 const { topicId } = req.params;

  const { topic_name, description, topic_id } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE res_course_topics SET topic_name = ?, description = ? WHERE topic_id = ?`,
      [topic_name, description, topic_id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "Topic not found." });
    }

    res.status(200).json({
      status: "success",
      message: "Topic updated successfully.",
    });

  } catch (error) {
    console.error("Error updating topic:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function deleteTopic(req, res) {
  const { topicId } = req.params;
  
  try {
    const [result] = await pool.execute(
      `DELETE FROM res_course_topics WHERE topic_id = ?`,
      [topicId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "Topic not found." });
    }

    res.status(200).json({
      status: "success",
      message: "Topic deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting topic:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function getCourseTopics(req, res) {
  const { courseId } = req.params;

  try {
    // Fetch topics for the course
    const [topics] = await pool.execute(
      `SELECT topic_id, topic_name, description FROM res_course_topics WHERE course_id = ?`,
      [courseId]
    );

    if (topics.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "No topics found for this course." });
    }

    // Fetch content for each topic
    for (const topic of topics) {
      const [content] = await pool.execute(
        `SELECT content_id, content_type, file_name, file_url, description, is_preview 
        FROM res_topic_content WHERE topic_id = ?`,
        [topic.topic_id]
      );
      topic.content = content;
    }

    res.status(200).json({ status: "success", data: topics });
  } catch (error) {
    console.error("Error fetching topics and content:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

module.exports = {
  createTopic,
  updateTopic,
  deleteTopic,
  getCourseTopics,
};
