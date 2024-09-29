const stripe = require('stripe')('sk_test_51OhdpnSEpSkidt63KbWjAT4Tq41H5ZdNKzTsbuqi0rJIupZS3iqK8QOojrZsC9h21LUUjar7bqgmDRaDOtV9a73r00mXQ0DDCr');

// Routes
app.post('/api/checkout/session', async (req, res) => {
  const { amount } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Donation',
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'An error occurred while creating the session' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
