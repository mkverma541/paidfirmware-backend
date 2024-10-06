const axios = require("axios");
const crypto = require("crypto");
const { insertOrder, checkExistingPayment } = require("./helper");
const { processOrder } = require("./processOrder");

// Binance API Key and Secret from environment variables
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

// Function to create HMAC SHA-512 signature
const createSignature = (payload) => {
  const hmac = crypto.createHmac("sha512", BINANCE_API_SECRET);
  hmac.update(payload);
  return hmac.digest("hex").toUpperCase(); // Convert to uppercase as required
};

// Function to generate a nonce

const generateNonce = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    const pos = Math.floor(Math.random() * chars.length);
    nonce += chars.charAt(pos);
  }
  return nonce;
};

// Function to create order payload
const createOrderPayload = (merchantTradeNo, total, orderId) => ({
  env: {
    terminalType: "APP",
  },
  merchantTradeNo,
  orderAmount: total,
  currency: "USDT",
  returnUrl: `http://localhost:3001/payment/binance?trade_number=${merchantTradeNo}`,
  goods: {
    goodsType: "01",
    goodsCategory: "D000",
    referenceGoodsId: orderId.toString(),
    goodsName: "Paid Firmware",
    goodsDetail: "Paid Firmware",
  },
});

// Create order function
async function createOrder(req, res) {
  try {
    // Generate timestamp and nonce
    const timestamp = Date.now();
    const nonce = generateNonce();
    const { id } = req.user;

    // Fetch the total amount for the user's cart and create a new order
    // const total = await fetchTotalAmount(id);

    const total = 0.0001;

    let merchantTradeNumber =
      Math.floor(Math.random() * (9825382937292 - 982538)) + 982538;

    const orderId = await insertOrder(
      id,
      merchantTradeNumber,
      total,
      "Binance",
      "USD"
    );

    // Prepare the payload
    const payload = createOrderPayload(orderId, total, orderId);
    const jsonPayload = JSON.stringify(payload);

    // Create the signature
    const signaturePayload = `${timestamp}\n${nonce}\n${jsonPayload}\n`;
    const signature = createSignature(signaturePayload);

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": BINANCE_API_KEY,
      "BinancePay-Signature": signature,
    };

    // Send the request to Binance Pay API
    const response = await axios.post(
      "https://bpay.binanceapi.com/binancepay/openapi/v2/order",
      payload,
      { headers }
    );

    // Handle the response
    if (response.data.status === "SUCCESS") {
      res
        .status(200)
        .json({
          response: response.data,
          merchantTradeNo: payload.merchantTradeNo,
        });
    } else {
      res.status(400).json({
        error: "Failed to create Binance payment order",
        details: response.data,
      });
    }
  } catch (error) {
    console.error(
      "Error creating payment order:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Check payment status function
async function checkPaymentStatus(req, res) {
  try {
    const { merchantTradeNo } = req.body;
    const { id } = req.user;
    const timestamp = Date.now();
    const nonce = generateNonce();

    // Prepare the payload
    const payload = { merchantTradeNo };
    const jsonPayload = JSON.stringify(payload);

    // Create the signature
    const signaturePayload = `${timestamp}\n${nonce}\n${jsonPayload}\n`;
    const signature = createSignature(signaturePayload);

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": BINANCE_API_KEY,
      "BinancePay-Signature": signature,
    };

    // Send the request to Binance Pay API
    const response = await axios.post(
      "https://bpay.binanceapi.com/binancepay/openapi/v2/order/query",
      payload,
      { headers }
    );

    console.log(response.data, "binacne");

    const existingPayment = await checkExistingPayment(merchantTradeNo); // You should implement this function

    if (existingPayment) {
      return res.status(200).json({
        status: "info",
        message: "Payment has already been processed.",
        order_id: response.data.data.merchantTradeNo,
      });
    }

    // Handle the response
    if (response.data.status === "SUCCESS") {
      const orderId = response.data.data.merchantTradeNo;
      const transactionId = response.data.data.transactionId;

      console.log(orderId);

      await processOrder(id, orderId, transactionId, res);

      res.status(200).json({
        status: "success",
        message: "Payment processed successfully",
        order_id: orderId,
      });
    } else {
      res.status(400).json({
        error: "Failed to query Binance payment order",
        details: response.data,
      });
    }
  } catch (error) {
    console.error(
      "Error querying payment order:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  createOrder,
  checkPaymentStatus,
};
