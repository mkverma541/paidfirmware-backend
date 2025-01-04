
const { pool } = require("../../config/database");

async function transferBalance(req, res) {
  const { id } = req.user; // Sender's user ID
  const { receiver_email, amount, notes } = req.body;

  // Start a transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  // Validate input
  if (amount <= 0 || isNaN(amount)) {
    connection.release();
    return res.status(400).json({
      message: "Amount must be a positive number.",
      status: "error",
    });
  }

  try {
    // Fetch sender's details
    const [[sender]] = await connection.query(
      `SELECT user_id, username, email, balance FROM res_users WHERE user_id = ?`,
      [id]
    );

    // Check if the sender and receiver are the same
    if (receiver_email === sender.email) {
      connection.release();
      return res.status(400).json({
        message: "You cannot transfer money to yourself.",
        status: "error",
      });
    }

    if (!sender) {
      connection.release();
      return res.status(404).json({
        message: "Sender not found.",
        status: "error",
      });
    }

    // Convert sender's balance to a number
    const senderBalance = parseFloat(sender.balance);

    if (senderBalance < amount) {
      connection.release();
      return res.status(400).json({
        message: "Insufficient balance to complete this transfer.",
        status: "error",
      });
    }

    // Fetch receiver's details
    const [[receiver]] = await connection.query(
      `SELECT user_id, username,  email, balance FROM res_users WHERE email = ?`,
      [receiver_email]
    );

    if (!receiver) {
      connection.release();
      return res.status(400).json({
        message: "The recipient's email does not exist.",
        status: "error",
      });
    }

    // Convert receiver's balance to a number
    const receiverBalance = parseFloat(receiver.balance);

    // Update sender's balance
    const senderNewBalance = senderBalance - parseFloat(amount);
    await connection.query(`UPDATE res_users SET balance = ? WHERE user_id = ?`, [
      senderNewBalance.toFixed(2),
      id,
    ]);

    // Update receiver's balance
    const receiverNewBalance = receiverBalance + parseFloat(amount);
    await connection.query(`UPDATE res_users SET balance = ? WHERE user_id = ?`, [
      receiverNewBalance.toFixed(2),
      receiver.user_id,
    ]);

    // Generate descriptions
    const debitDescription = `Credit sent to ${receiver.email}.`;
    const creditDescription = `Received credit from ${sender.email}.`;

    // Log transaction for the sender
    await connection.query(
      `INSERT INTO res_transfers (user_id, amount, username, notes, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, amount, receiver_email, notes, "debit", debitDescription]
    );

    // Log transaction for the receiver
    await connection.query(
      `INSERT INTO res_transfers (user_id, amount, username, notes, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [receiver.user_id, amount, sender.username, notes, "credit", creditDescription]
    );

    await connection.commit();
    connection.release();

    return res.status(201).json({
      message: "Transfer completed successfully!",
      status: "success",
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error("Error during transfer:", err);
    return res.status(500).json({
      message: "An error occurred while processing the transfer. Please try again.",
      status: "error",
    });
  }
}

async function getTotalBalance(req, res) {
  const { id } = req.user;

  try {
    const [[user]] = await pool.query(
      `SELECT balance FROM res_users WHERE user_id = ?`,
      [id]
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        status: "error",
      });
    }

    return res.status(200).json({
      balance: user.balance,
      status: "success",
    });
  } catch (err) {
    console.error("Error fetching balance:", err);
    return res.status(500).json({
      message: "An error occurred while fetching your balance. Please try again.",
      status: "error",
    });
  }
}

async function getTransactions(req, res) {
  const { id } = req.user;
  const { page = 1, limit = 10 } = req.query; // Default page is 1, limit is 10

  // Ensure `page` and `limit` are numbers and greater than 0
  const pageNumber = parseInt(page, 10);
  const pageSize = parseInt(limit, 10);

  if (isNaN(pageNumber) || pageNumber <= 0 || isNaN(pageSize) || pageSize <= 0) {
    return res.status(400).json({
      message: "Pagination parameters must be positive numbers.",
      status: "error",
    });
  }

  const offset = (pageNumber - 1) * pageSize; // Calculate the offset

  try {
    // Fetch total transactions count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM res_transfers WHERE user_id = ?`,
      [id]
    );

    // Fetch paginated transactions
    const [transactions] = await pool.query(
      `SELECT * FROM res_transfers WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [id, pageSize, offset]
    );

    const result = {
      data: transactions,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return res.status(200).json({
      status: "success",
      response: result,
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    return res.status(500).json({
      message: "An error occurred while fetching your transactions. Please try again.",
      status: "error",
    });
  }
}



module.exports = {
  transferBalance,
  getTotalBalance,
  getTransactions,
};

