require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.user_id;

    if (userId && userId !== 'guest') {
      try {
        await db.collection('users').doc(userId).update({ premium: true });
        console.log(`User ${userId} marked as premium.`);
      } catch (error) {
        console.error('Failed to update premium status:', error);
      }
    }
  } else {
    console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, username } = req.body;
    const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'PoleGuessr Premium Pass',
              description: 'Unlock exclusive backgrounds, profile backgrounds, and premium tags',
            },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}&username=${username}`,
      cancel_url: `${baseUrl}/polepass.html?cancelled=true`,
      metadata: {
        user_id: userId || 'guest',
        username: username || 'anonymous'
      }
    });
    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    stripe: !!process.env.STRIPE_SECRET_KEY
  });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

app.get('/test-stripe', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    const account = await stripe.accounts.retrieve();
    res.json({ status: 'ok', account: account.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});
