// chatController.js
const { pool } = require("../../config/database");

async function saveMessage(userId, content) {
  try {
    await pool.execute("INSERT INTO messages (user_id, content) VALUES (?, ?)", [
      userId,
      content,
    ]);
  } catch (error) {
    console.error("Database error:", error);
    throw new Error("Error saving message to the database");
  }
}

async function getMessages() {
  try {
    const [messages] = await pool.execute("SELECT * FROM messages ORDER BY timestamp ASC");
    return messages;
  } catch (error) {
    console.error("Database error:", error);
    throw new Error("Error retrieving messages from the database");
  }
}

module.exports = {
  saveMessage,
  getMessages,
};
