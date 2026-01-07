import Stripe from 'stripe';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

// Types for Stripe data stored in Firestore
export interface StripeConnection {
  id: string;
  organizationId: string;
  stripeAccountId?: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSyncAt?: Timestamp;
  lastError?: string;
  syncFrequency: 'realtime' | '1h' | '6h' | '24h';
  historicalDataRange: '12m' | '24m' | 'all';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface StripePayment {
  id: string;
  stripeId: string;
  amount: number;
  currency: string;
  status: string;
  customerId?: string;
  customerEmail?: string;
  description?: string;
  paymentMethod?: string;
  created: Timestamp;
  metadata?: Record<string, string>;
  syncedAt: Timestamp;
}

export interface StripeSubscription {
  id: string;
  stripeId: string;
  customerId: string;
  customerEmail?: string;
  status: string;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Timestamp;
  items: {
    priceId: string;
    productId: string;
    quantity: number;
    unitAmount: number;
    currency: string;
  }[];
  created: Timestamp;
  syncedAt: Timestamp;
}

export interface StripeCustomer {
  id: string;
  stripeId: string;
  email?: string;
  name?: string;
  created: Timestamp;
  currency?: string;
  totalSpent: number;
  subscriptionCount: number;
  syncedAt: Timestamp;
}

export interface StripeMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalCustomers: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lastCalculatedAt: Timestamp;
}

// Stripe Service Class
export class StripeService {
  private stripe: Stripe | null = null;
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  // Initialize Stripe with API key
  async initializeWithApiKey(apiKey: string): Promise<{ success: boolean; error?: string; accountId?: string }> {
    try {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2025-12-15.clover',
      });

      // Verify the API key by fetching account info
      const account = await this.stripe.accounts.retrieve();
      
      return { 
        success: true, 
        accountId: account.id 
      };
    } catch (error: any) {
      console.error('Stripe initialization error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to connect to Stripe' 
      };
    }
  }

  // Save connection to Firestore
  async saveConnection(userId: string, accountId?: string): Promise<void> {
    const connectionRef = doc(db, 'stripe_connections', this.organizationId);
    
    const connection: Omit<StripeConnection, 'id'> = {
      organizationId: this.organizationId,
      stripeAccountId: accountId,
      status: 'connected',
      syncFrequency: '1h',
      historicalDataRange: '12m',
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      createdBy: userId,
    };

    await setDoc(connectionRef, connection);
  }

  // Get connection status
  async getConnection(): Promise<StripeConnection | null> {
    const connectionRef = doc(db, 'stripe_connections', this.organizationId);
    const snapshot = await getDoc(connectionRef);
    
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as StripeConnection;
    }
    return null;
  }

  // Update connection status
  async updateConnectionStatus(status: StripeConnection['status'], error?: string): Promise<void> {
    const connectionRef = doc(db, 'stripe_connections', this.organizationId);
    await setDoc(connectionRef, {
      status,
      lastError: error || null,
      updatedAt: serverTimestamp(),
      ...(status === 'connected' ? { lastSyncAt: serverTimestamp() } : {}),
    }, { merge: true });
  }

  // Sync payments from Stripe
  async syncPayments(startDate?: Date): Promise<{ synced: number; error?: string }> {
    if (!this.stripe) {
      return { synced: 0, error: 'Stripe not initialized' };
    }

    try {
      const batch = writeBatch(db);
      let synced = 0;
      let hasMore = true;
      let startingAfter: string | undefined;

      const params: Stripe.ChargeListParams = {
        limit: 100,
        ...(startDate ? { created: { gte: Math.floor(startDate.getTime() / 1000) } } : {}),
      };

      while (hasMore) {
        const charges = await this.stripe.charges.list({
          ...params,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        for (const charge of charges.data) {
          const paymentRef = doc(db, 'stripe_payments', `${this.organizationId}_${charge.id}`);
          
          const payment: Omit<StripePayment, 'id'> = {
            stripeId: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status,
            customerId: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id,
            customerEmail: charge.billing_details?.email || undefined,
            description: charge.description || undefined,
            paymentMethod: charge.payment_method_details?.type,
            created: Timestamp.fromDate(new Date(charge.created * 1000)),
            metadata: charge.metadata as Record<string, string>,
            syncedAt: serverTimestamp() as Timestamp,
          };

          batch.set(paymentRef, payment);
          synced++;
        }

        hasMore = charges.has_more;
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }

        // Commit batch every 500 records
        if (synced % 500 === 0 && synced > 0) {
          await batch.commit();
        }
      }

      // Final commit
      await batch.commit();
      return { synced };
    } catch (error: any) {
      console.error('Error syncing payments:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Sync subscriptions from Stripe
  async syncSubscriptions(): Promise<{ synced: number; error?: string }> {
    if (!this.stripe) {
      return { synced: 0, error: 'Stripe not initialized' };
    }

    try {
      const batch = writeBatch(db);
      let synced = 0;
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const subscriptions = await this.stripe.subscriptions.list({
          limit: 100,
          expand: ['data.customer'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        for (const sub of subscriptions.data) {
          const subRef = doc(db, 'stripe_subscriptions', `${this.organizationId}_${sub.id}`);
          
          const customer = typeof sub.customer === 'string' ? null : sub.customer;
          
          const subscription: Omit<StripeSubscription, 'id'> = {
            stripeId: sub.id,
            customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
            customerEmail: customer?.email || undefined,
            status: sub.status,
            currentPeriodStart: Timestamp.fromDate(new Date(sub.current_period_start * 1000)),
            currentPeriodEnd: Timestamp.fromDate(new Date(sub.current_period_end * 1000)),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at ? Timestamp.fromDate(new Date(sub.canceled_at * 1000)) : undefined,
            items: sub.items.data.map(item => ({
              priceId: item.price.id,
              productId: typeof item.price.product === 'string' ? item.price.product : item.price.product.id,
              quantity: item.quantity || 1,
              unitAmount: item.price.unit_amount || 0,
              currency: item.price.currency,
            })),
            created: Timestamp.fromDate(new Date(sub.created * 1000)),
            syncedAt: serverTimestamp() as Timestamp,
          };

          batch.set(subRef, subscription);
          synced++;
        }

        hasMore = subscriptions.has_more;
        if (subscriptions.data.length > 0) {
          startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
        }
      }

      await batch.commit();
      return { synced };
    } catch (error: any) {
      console.error('Error syncing subscriptions:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Sync customers from Stripe
  async syncCustomers(): Promise<{ synced: number; error?: string }> {
    if (!this.stripe) {
      return { synced: 0, error: 'Stripe not initialized' };
    }

    try {
      const batch = writeBatch(db);
      let synced = 0;
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const customers = await this.stripe.customers.list({
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        for (const cust of customers.data) {
          const custRef = doc(db, 'stripe_customers', `${this.organizationId}_${cust.id}`);
          
          const customer: Omit<StripeCustomer, 'id'> = {
            stripeId: cust.id,
            email: cust.email || undefined,
            name: cust.name || undefined,
            created: Timestamp.fromDate(new Date(cust.created * 1000)),
            currency: cust.currency || undefined,
            totalSpent: 0, // Will be calculated from payments
            subscriptionCount: 0, // Will be calculated from subscriptions
            syncedAt: serverTimestamp() as Timestamp,
          };

          batch.set(custRef, customer);
          synced++;
        }

        hasMore = customers.has_more;
        if (customers.data.length > 0) {
          startingAfter = customers.data[customers.data.length - 1].id;
        }
      }

      await batch.commit();
      return { synced };
    } catch (error: any) {
      console.error('Error syncing customers:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Calculate and save metrics
  async calculateMetrics(): Promise<StripeMetrics> {
    // Get all active subscriptions
    const subsQuery = query(
      collection(db, 'stripe_subscriptions'),
      where('status', '==', 'active')
    );
    const subsSnapshot = await getDocs(subsQuery);
    
    let mrr = 0;
    const activeSubscriptions = subsSnapshot.size;

    subsSnapshot.forEach((doc) => {
      const sub = doc.data() as StripeSubscription;
      // Calculate MRR from subscription items
      sub.items.forEach(item => {
        // Assuming monthly billing, adjust for annual
        mrr += (item.unitAmount * item.quantity) / 100;
      });
    });

    // Get total customers
    const customersQuery = query(collection(db, 'stripe_customers'));
    const customersSnapshot = await getDocs(customersQuery);
    const totalCustomers = customersSnapshot.size;

    // Calculate metrics
    const metrics: StripeMetrics = {
      mrr,
      arr: mrr * 12,
      activeSubscriptions,
      totalCustomers,
      churnRate: 0, // Would need historical data to calculate
      averageRevenuePerUser: totalCustomers > 0 ? mrr / totalCustomers : 0,
      lastCalculatedAt: serverTimestamp() as Timestamp,
    };

    // Save metrics
    const metricsRef = doc(db, 'stripe_metrics', this.organizationId);
    await setDoc(metricsRef, metrics);

    return metrics;
  }

  // Full sync
  async fullSync(userId: string): Promise<{ 
    success: boolean; 
    payments: number; 
    subscriptions: number; 
    customers: number;
    error?: string;
  }> {
    try {
      await this.updateConnectionStatus('syncing');

      const [paymentsResult, subscriptionsResult, customersResult] = await Promise.all([
        this.syncPayments(),
        this.syncSubscriptions(),
        this.syncCustomers(),
      ]);

      if (paymentsResult.error || subscriptionsResult.error || customersResult.error) {
        const error = paymentsResult.error || subscriptionsResult.error || customersResult.error;
        await this.updateConnectionStatus('error', error);
        return {
          success: false,
          payments: paymentsResult.synced,
          subscriptions: subscriptionsResult.synced,
          customers: customersResult.synced,
          error,
        };
      }

      // Calculate metrics after sync
      await this.calculateMetrics();
      await this.updateConnectionStatus('connected');

      return {
        success: true,
        payments: paymentsResult.synced,
        subscriptions: subscriptionsResult.synced,
        customers: customersResult.synced,
      };
    } catch (error: any) {
      await this.updateConnectionStatus('error', error.message);
      return {
        success: false,
        payments: 0,
        subscriptions: 0,
        customers: 0,
        error: error.message,
      };
    }
  }

  // Disconnect Stripe
  async disconnect(): Promise<void> {
    const connectionRef = doc(db, 'stripe_connections', this.organizationId);
    await setDoc(connectionRef, {
      status: 'disconnected',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  // Get metrics
  async getMetrics(): Promise<StripeMetrics | null> {
    const metricsRef = doc(db, 'stripe_metrics', this.organizationId);
    const snapshot = await getDoc(metricsRef);
    
    if (snapshot.exists()) {
      return snapshot.data() as StripeMetrics;
    }
    return null;
  }
}

// Helper to create a new Stripe service instance
export function createStripeService(organizationId: string): StripeService {
  return new StripeService(organizationId);
}

