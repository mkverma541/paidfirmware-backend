const axios = require("axios");

// Use environment variables to secure your token

const TelegramBot = require("node-telegram-bot-api");

// Load environment variables
require("dotenv").config();

const botToken = "7789265160:AAGyv1b_RRE9JOsv5OxGU5hEu6gfP8grT00";
const chatId = "@paid_firmware_bot"; // Replace with your channel ID or username

// Initialize the bot
const bot = new TelegramBot(botToken, { polling: false }); // Set polling to false for sending messages only

async function sendOrderDetailsToTelegram(req, res) {
  try {


    // Create the message
    const message = `test`;

    // Send the message to Telegram
    await bot.sendMessage(chatId, message);

    console.log("Order details sent successfully!");
    res.status(200).json({ message: "Order details sent successfully!" });
  } catch (error) {
    console.error("Error sending order details to Telegram:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  sendOrderDetailsToTelegram,
};
