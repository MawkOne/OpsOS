// Script to analyze unlabeled Stripe invoices
// Run with: node scripts/analyze-unlabeled-invoices.js

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function analyzeUnlabeledInvoices() {
  try {
    console.log('🔍 Analyzing Stripe invoices for unlabeled transactions...\n');

    // Get organization ID from user input or use first found
    const orgsSnap = await db.collection('organizations').limit(1).get();
    if (orgsSnap.empty) {
      console.log('❌ No organizations found');
      return;
    }

    const organizationId = orgsSnap.docs[0].id;
    console.log(`📊 Organization ID: ${organizationId}\n`);

    // Query invoices
    const invoicesSnap = await db.collection('stripe_invoices')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'paid')
      .limit(100)
      .get();

    console.log(`📄 Total paid invoices found: ${invoicesSnap.size}\n`);

    const analysis = {
      withProductIds: 0,
      withoutProductIds: 0,
      noLineItems: 0,
      samples: []
    };

    invoicesSnap.docs.forEach((doc) => {
      const invoice = doc.data();
      const lineItems = invoice.lineItems || [];

      if (lineItems.length === 0) {
        analysis.noLineItems++;
        
        if (analysis.samples.length < 5) {
          analysis.samples.push({
            category: 'NO_LINE_ITEMS',
            stripeId: invoice.stripeId,
            total: (invoice.total || 0) / 100,
            subscriptionId: invoice.subscriptionId || null,
            billingReason: invoice.billingReason || null,
            customerName: invoice.customerName || invoice.customerEmail,
            description: invoice.description || null,
          });
        }
      } else {
        const hasProducts = lineItems.some(item => item.productId);
        
        if (hasProducts) {
          analysis.withProductIds++;
        } else {
          analysis.withoutProductIds++;
          
          if (analysis.samples.length < 5) {
            analysis.samples.push({
              category: 'NO_PRODUCT_ID',
              stripeId: invoice.stripeId,
              total: (invoice.total || 0) / 100,
              subscriptionId: invoice.subscriptionId || null,
              billingReason: invoice.billingReason || null,
              customerName: invoice.customerName || invoice.customerEmail,
              lineItems: lineItems.map(item => ({
                description: item.description,
                amount: (item.amount || 0) / 100,
                type: item.type,
                priceId: item.priceId,
                productId: item.productId,
              })),
            });
          }
        }
      }
    });

    console.log('📊 ANALYSIS RESULTS:\n');
    console.log(`✅ With product IDs: ${analysis.withProductIds}`);
    console.log(`❌ Without product IDs: ${analysis.withoutProductIds}`);
    console.log(`❌ No line items: ${analysis.noLineItems}`);
    console.log(`\n📋 Unlabeled percentage: ${((analysis.withoutProductIds + analysis.noLineItems) / invoicesSnap.size * 100).toFixed(1)}%\n`);

    if (analysis.samples.length > 0) {
      console.log('🔍 SAMPLE UNLABELED INVOICES:\n');
      analysis.samples.forEach((sample, idx) => {
        console.log(`\n--- Sample #${idx + 1} (${sample.category}) ---`);
        console.log(JSON.stringify(sample, null, 2));
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeUnlabeledInvoices();
