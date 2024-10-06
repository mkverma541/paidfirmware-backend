const axios = require('axios');
const crypto = require('crypto');

// Binance API Key and Secret from environment variables
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

// Function to create HMAC SHA-512 signature
const createSignature = (payload) => {
  const hmac = crypto.createHmac('sha512', BINANCE_API_SECRET);
  hmac.update(payload);
  return hmac.digest('hex').toUpperCase(); // Convert to uppercase as required
};

// Function to generate a nonce (random string with lowercase and uppercase letters)
const generateNonce = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    const pos = Math.floor(Math.random() * chars.length);
    nonce += chars.charAt(pos);
  }
  return nonce;
};

// Create order function
async function createOrder(req, res) {
  try {
    // Generate timestamp and nonce
    const timestamp = Date.now();
    const nonce = generateNonce();

    // Prepare the payload based on the PHP structure
    const payload = {
      env: {
        terminalType: 'APP',
      },
      merchantTradeNo: Math.floor(Math.random() * (9825382937292 - 982538)) + 982538, // Random trade number
      orderAmount: 0.0001,
      currency: 'USDT',
      returnUrl: 'http://localhost:3001/payment?ref=binance',
      goods: {
        goodsType: '01',
        goodsCategory: 'D000',
        referenceGoodsId: '7876763A3B',
        goodsName: 'Ice Cream',
        goodsDetail: 'Greentea ice cream cone',
      },
    };
    console.log(payload);

    const jsonPayload = JSON.stringify(payload);

    // Create the signature payload
    const signaturePayload = `${timestamp}\n${nonce}\n${jsonPayload}\n`;
    const signature = createSignature(signaturePayload);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': BINANCE_API_KEY,
      'BinancePay-Signature': signature,
    };

    // Send the request to Binance Pay API
    const response = await axios.post(
      'https://bpay.binanceapi.com/binancepay/openapi/v2/order',
      payload,
      { headers }
    );

    // Handle the response
    if (response.data.status === 'SUCCESS') {
      console.log(response.data);
      res.status(200).json({ response: response.data, merchantTradeNo: payload.merchantTradeNo });
     
    } else {
      res.status(400).json({
        error: 'Failed to create Binance payment order',
        details: response.data,
      });
    }
  } catch (error) {
    console.error('Error creating payment order:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function checkPaymentStatus(req, res) {
  try {
    // Generate timestamp and nonce
    const timestamp = Date.now();
    const nonce = generateNonce();

    // Prepare the payload based on the PHP structure
    const payload = {
      merchantTradeNo: req.body.merchantTradeNo,
    };

    const jsonPayload = JSON.stringify(payload);

    // Create the signature payload
    const signaturePayload = `${timestamp}\n${nonce}\n${jsonPayload}\n`;
    const signature = createSignature(signaturePayload);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': BINANCE_API_KEY,
      'BinancePay-Signature': signature,
    };

    // Send the request to Binance Pay API
    const response = await axios.post(
      'https://bpay.binanceapi.com/binancepay/openapi/v2/order/query',
      payload,
      { headers }
    );

    // Handle the response
    if (response.data.status === 'SUCCESS') {
      console.log(response.data);
      res.status(200).json({ response: response.data });
    } else {
      res.status(400).json({
        error: 'Failed to query Binance payment order',
        details: response.data,
      });
    }

  } catch (error) {
    console.error('Error querying payment order:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  createOrder,
  checkPaymentStatus,
};
