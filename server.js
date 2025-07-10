const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - SVARBU EILIŠKUMAS!
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Create checkout session endpoint
app.post('/create-checkout-session', async (req, res) => {
  try {
    console.log('Creating checkout session for:', req.body);
    
    const { userId, username } = req.body;
    
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
            unit_amount: 499, // $4.99 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/polepass.html`,
      metadata: {
        user_id: userId || 'guest',
        username: username || 'anonymous'
      }
    });

    console.log('Checkout session created:', session.id);
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log(`Requested: ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test the server: http://localhost:${PORT}/test`);
  console.log(`Access PolePass: http://localhost:${PORT}/polepass.html`);
});