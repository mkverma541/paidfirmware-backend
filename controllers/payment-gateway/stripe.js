require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { pool } = require("../../config/database");
const { addPurchasedPackage } = require("../users");
const { addTransaction } = require("../transactions");

async function createSession(req, res) {
  const options = req.body;

  try {
    const session = await stripe.checkout.sessions.create(options);

    console.log(session);
    res.json({
      status: "success",
      url: session.url,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
}

async function fetchPayment(req, res) {
  const sessionID = req.params.id;
  const user = req.user;
  console.log(sessionID, "Session ID");
  console.log(user, "User");

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const session = await stripe.checkout.sessions.retrieve(sessionID);
    await addTransaction(session, user);

    const packageID = session.metadata.package_id;

    console.log(session, "Session");

    if (session.payment_status === "paid") {
      await addPurchasedPackage(connection, user, packageID, res);

      await connection.commit();
    }
  } catch (error) {
    console.error(error);

    await connection.rollback();

    res.status(500).json({
      error: error.message || "Internal Server Error",
    });
  } finally {
    connection.release();
  }
}

async function fetchSessions(req, res) {
  try {
    const sessions = await stripe.checkout.sessions.list();
    return res.status(200).json({
      status: "success",
      data: sessions,
    });
    console.log(sessions);
  } catch (err) {
    res.status(500).json({
      error: error,
    });
    console.log(err);
  }
}

module.exports = { createSession, fetchPayment, fetchSessions };
