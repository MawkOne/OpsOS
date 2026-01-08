import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const CONNECTED_ACCOUNT_ID = 'acct_1LsrkZHA09Yt9PAO';

if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY not set!');
  console.log('Run: export STRIPE_SECRET_KEY=sk_live_xxx');
  process.exit(1);
}

console.log('Using STRIPE_SECRET_KEY:', STRIPE_SECRET_KEY.substring(0, 12) + '...');
console.log('Connected Account:', CONNECTED_ACCOUNT_ID);

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  stripeAccount: CONNECTED_ACCOUNT_ID,
});

try {
  const invoices = await stripe.invoices.list({ limit: 10 });
  console.log('\n=== INVOICES FOUND:', invoices.data.length, '===');
  invoices.data.forEach((inv, i) => {
    console.log(`${i+1}. ${inv.id} | $${(inv.amount_paid/100).toFixed(2)} | ${inv.status} | ${new Date(inv.created * 1000).toLocaleDateString()}`);
  });
  console.log('has_more:', invoices.has_more);
} catch (err) {
  console.error('STRIPE ERROR:', err.message);
}
