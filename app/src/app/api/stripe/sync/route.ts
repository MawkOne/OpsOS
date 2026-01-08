import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection,
  writeBatch,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, syncType = 'full' } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required field: organizationId' },
        { status: 400 }
      );
    }

    // Get the connection to retrieve stored access token or account ID
    const connectionRef = doc(db, 'stripe_connections', organizationId);
    const connectionDoc = await getDoc(connectionRef);
    
    if (!connectionDoc.exists()) {
      return NextResponse.json(
        { error: 'No Stripe connection found. Please connect first.' },
        { status: 404 }
      );
    }
    
    const connectionData = connectionDoc.data();
    
    // For Stripe Connect OAuth, we need to use either:
    // 1. The access token directly (for standard OAuth)
    // 2. Platform secret key + stripeAccount header (for Connect)
    let stripe: Stripe;
    const PLATFORM_SECRET = process.env.STRIPE_SECRET_KEY;
    
    if (connectionData?.stripeAccountId && PLATFORM_SECRET) {
      // Best approach: Use platform secret with connected account ID
      console.log('Using platform secret with stripeAccount:', connectionData.stripeAccountId);
      stripe = new Stripe(PLATFORM_SECRET, {
        apiVersion: '2025-12-15.clover',
        stripeAccount: connectionData.stripeAccountId,
      });
    } else if (connectionData?.accessToken) {
      // Fallback: OAuth access token directly
      console.log('Using OAuth access token directly');
      stripe = new Stripe(connectionData.accessToken, {
        apiVersion: '2025-12-15.clover',
      });
    } else if (connectionData?.apiKey) {
      // Legacy API key connection
      console.log('Using legacy API key');
      stripe = new Stripe(connectionData.apiKey, {
        apiVersion: '2025-12-15.clover',
      });
    } else {
      return NextResponse.json(
        { error: 'No valid Stripe credentials found. Please reconnect your Stripe account.' },
        { status: 400 }
      );
    }

    // Update status to syncing
    await setDoc(connectionRef, {
      status: 'syncing',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const results = {
      payments: 0,
      subscriptions: 0,
      customers: 0,
      products: 0,
      prices: 0,
      invoices: 0,
      errors: [] as string[],
    };

    // Sync Payments/Charges with invoice expansion for product attribution
    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const charges = await stripe.charges.list({
          limit: 100,
          expand: ['data.invoice.lines.data.price.product', 'data.invoice.subscription'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        const batch = writeBatch(db);

        for (const charge of charges.data) {
          const paymentRef = doc(db, 'stripe_payments', `${organizationId}_${charge.id}`);
          
          // Extract invoice and line items for product attribution
          // Use type assertion since Stripe types vary by API version
          const chargeAny = charge as any;
          const invoice = typeof chargeAny.invoice === 'object' ? chargeAny.invoice : null;
          let lineItems: any[] = [];
          let subscriptionId: string | null = null;
          
          if (invoice && invoice.lines?.data) {
            lineItems = invoice.lines.data.map((line: any) => {
              const product = line.price?.product;
              const productId = typeof product === 'string' ? product : product?.id || null;
              const productName = typeof product === 'object' && product && !product.deleted 
                ? product.name 
                : null;
              
              return {
                description: line.description,
                amount: line.amount,
                quantity: line.quantity || 1,
                priceId: line.price?.id || null,
                productId,
                productName, // Store product name directly on line item
              };
            });
            subscriptionId = typeof invoice.subscription === 'string' 
              ? invoice.subscription 
              : invoice.subscription?.id || null;
          }
          
          batch.set(paymentRef, {
            organizationId,
            stripeId: charge.id,
            amount: charge.amount,
            amountFormatted: (charge.amount / 100).toFixed(2),
            currency: charge.currency.toUpperCase(),
            status: charge.status,
            customerId: typeof charge.customer === 'string' ? charge.customer : (charge.customer as any)?.id || null,
            customerEmail: charge.billing_details?.email || null,
            description: charge.description || null,
            paymentMethod: charge.payment_method_details?.type || null,
            created: Timestamp.fromDate(new Date(charge.created * 1000)),
            metadata: charge.metadata || {},
            refunded: charge.refunded,
            amountRefunded: charge.amount_refunded,
            // Product attribution fields
            invoiceId: typeof chargeAny.invoice === 'string' ? chargeAny.invoice : invoice?.id || null,
            subscriptionId,
            lineItems,
            syncedAt: serverTimestamp(),
          });
          results.payments++;
        }

        await batch.commit();

        hasMore = charges.has_more;
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }
      }
    } catch (error: any) {
      results.errors.push(`Payments sync error: ${error.message}`);
    }

    // Sync Subscriptions
    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const subscriptions = await stripe.subscriptions.list({
          limit: 100,
          expand: ['data.customer', 'data.items.data.price.product'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        const batch = writeBatch(db);

        for (const sub of subscriptions.data) {
          const subRef = doc(db, 'stripe_subscriptions', `${organizationId}_${sub.id}`);
          const customerRaw = typeof sub.customer === 'string' ? null : sub.customer;
          const customer = customerRaw && !(customerRaw as any).deleted ? customerRaw as any : null;
          
          // Calculate MRR for this subscription
          let monthlyAmount = 0;
          const items = sub.items.data.map(item => {
            const unitAmount = item.price.unit_amount || 0;
            const quantity = item.quantity || 1;
            
            // Convert to monthly if annual
            let monthlyUnitAmount = unitAmount;
            if (item.price.recurring?.interval === 'year') {
              monthlyUnitAmount = unitAmount / 12;
            } else if (item.price.recurring?.interval === 'week') {
              monthlyUnitAmount = unitAmount * 4;
            }
            
            monthlyAmount += (monthlyUnitAmount * quantity);

            const product = item.price.product as any;
            return {
              priceId: item.price.id,
              productId: typeof product === 'string' ? product : product?.id,
              productName: typeof product === 'object' && product && !product.deleted ? product.name : null,
              quantity,
              unitAmount,
              currency: item.price.currency.toUpperCase(),
              interval: item.price.recurring?.interval || 'month',
            };
          });

          // Cast to any to handle varying Stripe API versions
          const subAny = sub as any;
          batch.set(subRef, {
            organizationId,
            stripeId: sub.id,
            customerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id,
            customerEmail: customer?.email || null,
            customerName: customer?.name || null,
            status: sub.status,
            currentPeriodStart: subAny.current_period_start ? Timestamp.fromDate(new Date(subAny.current_period_start * 1000)) : null,
            currentPeriodEnd: subAny.current_period_end ? Timestamp.fromDate(new Date(subAny.current_period_end * 1000)) : null,
            cancelAtPeriodEnd: subAny.cancel_at_period_end || false,
            canceledAt: subAny.canceled_at ? Timestamp.fromDate(new Date(subAny.canceled_at * 1000)) : null,
            items,
            mrr: monthlyAmount / 100, // Store in dollars
            created: Timestamp.fromDate(new Date(sub.created * 1000)),
            syncedAt: serverTimestamp(),
          });
          results.subscriptions++;
        }

        await batch.commit();

        hasMore = subscriptions.has_more;
        if (subscriptions.data.length > 0) {
          startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
        }
      }
    } catch (error: any) {
      results.errors.push(`Subscriptions sync error: ${error.message}`);
    }

    // Sync Products
    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const products = await stripe.products.list({
          limit: 100,
          active: true,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        const batch = writeBatch(db);

        for (const product of products.data) {
          const productRef = doc(db, 'stripe_products', `${organizationId}_${product.id}`);
          
          batch.set(productRef, {
            organizationId,
            stripeId: product.id,
            name: product.name,
            description: product.description || null,
            active: product.active,
            images: product.images || [],
            metadata: product.metadata || {},
            defaultPriceId: typeof product.default_price === 'string' 
              ? product.default_price 
              : product.default_price?.id || null,
            created: Timestamp.fromDate(new Date(product.created * 1000)),
            updated: Timestamp.fromDate(new Date(product.updated * 1000)),
            syncedAt: serverTimestamp(),
          });
          results.products++;
        }

        await batch.commit();

        hasMore = products.has_more;
        if (products.data.length > 0) {
          startingAfter = products.data[products.data.length - 1].id;
        }
      }
    } catch (error: any) {
      results.errors.push(`Products sync error: ${error.message}`);
    }

    // Sync Prices
    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const prices = await stripe.prices.list({
          limit: 100,
          active: true,
          expand: ['data.product'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        const batch = writeBatch(db);

        for (const price of prices.data) {
          const priceRef = doc(db, 'stripe_prices', `${organizationId}_${price.id}`);
          const productRaw = typeof price.product === 'string' ? null : price.product;
          const product = productRaw && !(productRaw as any).deleted ? productRaw as any : null;
          
          batch.set(priceRef, {
            organizationId,
            stripeId: price.id,
            productId: typeof price.product === 'string' ? price.product : (price.product as any)?.id,
            productName: product?.name || null,
            active: price.active,
            currency: price.currency.toUpperCase(),
            unitAmount: price.unit_amount || 0,
            unitAmountFormatted: price.unit_amount ? (price.unit_amount / 100).toFixed(2) : '0.00',
            type: price.type, // 'one_time' or 'recurring'
            recurring: price.recurring ? {
              interval: price.recurring.interval,
              intervalCount: price.recurring.interval_count,
            } : null,
            billingScheme: price.billing_scheme,
            metadata: price.metadata || {},
            created: Timestamp.fromDate(new Date(price.created * 1000)),
            syncedAt: serverTimestamp(),
          });
          results.prices++;
        }

        await batch.commit();

        hasMore = prices.has_more;
        if (prices.data.length > 0) {
          startingAfter = prices.data[prices.data.length - 1].id;
        }
      }
    } catch (error: any) {
      results.errors.push(`Prices sync error: ${error.message}`);
    }

    // Sync Invoices (better product attribution than charges)
    try {
      let hasMore = true;
      let startingAfter: string | undefined;
      let totalInvoicesFromStripe = 0;

      while (hasMore) {
        const invoices = await stripe.invoices.list({
          limit: 100,
          expand: ['data.lines.data.price.product', 'data.subscription'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        totalInvoicesFromStripe += invoices.data.length;
        console.log(`Stripe returned ${invoices.data.length} invoices, statuses:`, invoices.data.map(i => i.status));

        const batch = writeBatch(db);

        for (const invoice of invoices.data) {
          // Sync ALL invoices (paid, open, draft, void, uncollectible)
          // We'll filter by status when querying for revenue
          
          const invoiceRef = doc(db, 'stripe_invoices', `${organizationId}_${invoice.id}`);
          
          // Extract line items with product info
          const lineItems = invoice.lines?.data?.map((line: any) => {
            const product = line.price?.product;
            return {
              description: line.description,
              amount: line.amount,
              quantity: line.quantity || 1,
              priceId: line.price?.id || null,
              productId: typeof product === 'string' ? product : product?.id || null,
              productName: typeof product === 'object' && product && !product.deleted ? product.name : null,
            };
          }) || [];

          const invoiceAny = invoice as any;
          const subscriptionId = typeof invoiceAny.subscription === 'string' 
            ? invoiceAny.subscription 
            : invoiceAny.subscription?.id || null;

          batch.set(invoiceRef, {
            organizationId,
            stripeId: invoice.id,
            chargeId: typeof invoiceAny.charge === 'string' ? invoiceAny.charge : invoiceAny.charge?.id || null,
            subscriptionId,
            customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as any)?.id || null,
            amount: invoice.amount_paid,
            currency: invoice.currency?.toUpperCase() || 'USD',
            status: invoice.status,
            created: Timestamp.fromDate(new Date(invoice.created * 1000)),
            periodStart: invoiceAny.period_start ? Timestamp.fromDate(new Date(invoiceAny.period_start * 1000)) : null,
            periodEnd: invoiceAny.period_end ? Timestamp.fromDate(new Date(invoiceAny.period_end * 1000)) : null,
            lineItems,
            syncedAt: serverTimestamp(),
          });
          results.invoices++;
        }

        await batch.commit();

        hasMore = invoices.has_more;
        if (invoices.data.length > 0) {
          startingAfter = invoices.data[invoices.data.length - 1].id;
        }
      }
      console.log(`Invoices sync complete: ${results.invoices} saved from ${totalInvoicesFromStripe} total`);
    } catch (error: any) {
      console.error('Invoices sync error:', error);
      results.errors.push(`Invoices sync error: ${error.message}`);
    }

    // Sync Customers
    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const customers = await stripe.customers.list({
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        const batch = writeBatch(db);

        for (const cust of customers.data) {
          const custRef = doc(db, 'stripe_customers', `${organizationId}_${cust.id}`);
          
          batch.set(custRef, {
            organizationId,
            stripeId: cust.id,
            email: cust.email || null,
            name: cust.name || null,
            phone: cust.phone || null,
            created: Timestamp.fromDate(new Date(cust.created * 1000)),
            currency: cust.currency?.toUpperCase() || null,
            metadata: cust.metadata || {},
            syncedAt: serverTimestamp(),
          });
          results.customers++;
        }

        await batch.commit();

        hasMore = customers.has_more;
        if (customers.data.length > 0) {
          startingAfter = customers.data[customers.data.length - 1].id;
        }
      }
    } catch (error: any) {
      results.errors.push(`Customers sync error: ${error.message}`);
    }

    // Update connection status
    const finalStatus = results.errors.length > 0 ? 'error' : 'connected';
    await setDoc(connectionRef, {
      status: finalStatus,
      lastSyncAt: serverTimestamp(),
      lastSyncResults: {
        payments: results.payments,
        subscriptions: results.subscriptions,
        customers: results.customers,
        products: results.products,
        prices: results.prices,
        invoices: results.invoices,
        errors: results.errors,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error: any) {
    console.error('Stripe sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Stripe data' },
      { status: 500 }
    );
  }
}

