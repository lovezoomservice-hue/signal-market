/**
 * Stripe Client - Payment Integration for Signal Market
 * Handles checkout sessions, webhooks, and subscription management
 */

const Stripe = require('stripe');
const crypto = require('crypto');

// Plan configurations
const PLANS = {
  free: {
    name: 'Free',
    priceId: null, // No Stripe subscription
    price: 0,
    apiCalls: 1000,
    signals: 5,
    historyDays: 7,
    customStrategies: 0,
    realtimePush: false,
    prioritySupport: false,
    sla: null,
    maxAccounts: 1,
    webhookConcurrency: 1,
    analytics: 'none'
  },
  basic: {
    name: 'Basic',
    priceId: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic_xxxxx',
    price: 199, // CNY
    priceUsd: 29,
    apiCalls: 50000,
    signals: 50,
    historyDays: 90,
    customStrategies: 3,
    realtimePush: true,
    prioritySupport: false,
    sla: null,
    maxAccounts: 5,
    webhookConcurrency: 10,
    analytics: 'basic'
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_xxxxx',
    price: 699, // CNY
    priceUsd: 99,
    apiCalls: 500000,
    signals: 200,
    historyDays: 730,
    customStrategies: 20,
    realtimePush: true,
    prioritySupport: true,
    sla: '99.9%',
    maxAccounts: 50,
    webhookConcurrency: 50,
    analytics: 'advanced'
  },
  enterprise: {
    name: 'Enterprise',
    priceId: null, // Custom pricing
    price: null,
    apiCalls: Infinity,
    signals: Infinity,
    historyDays: Infinity,
    customStrategies: Infinity,
    realtimePush: true,
    prioritySupport: true,
    sla: '99.99%',
    maxAccounts: Infinity,
    webhookConcurrency: Infinity,
    analytics: 'custom'
  }
};

class StripeClient {
  constructor() {
    this.stripe = process.env.STRIPE_SECRET_KEY 
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;
    
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.baseUrl = process.env.BASE_URL || 'https://signal.market';
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(userId, plan, successUrl, cancelUrl) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const planConfig = PLANS[plan];
    if (!planConfig || !planConfig.priceId) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'alipay', 'wechat_pay'],
      line_items: [{
        price: planConfig.priceId,
        quantity: 1
      }],
      success_url: successUrl || `${this.baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${this.baseUrl}/payment/cancel`,
      client_reference_id: userId,
      metadata: {
        userId,
        plan
      },
      // For Chinese customers
      locale: 'auto',
      currency: 'cny',
      billing_address_collection: 'required'
    });

    return session;
  }

  /**
   * Create a customer portal session for subscription management
   */
  async createPortalSession(customerId, returnUrl) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || this.baseUrl
    });

    return session;
  }

  /**
   * Retrieve subscription details
   */
  async getSubscription(subscriptionId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
  }

  /**
   * Resume a cancelled subscription
   */
  async resumeSubscription(subscriptionId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(subscriptionId, newPriceId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId
      }],
      proration_behavior: 'create_prorations'
    });
  }

  /**
   * Create or get customer
   */
  async createOrGetCustomer(userId, email, name) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    // Search for existing customer
    const customers = await this.stripe.customers.list({
      email,
      limit: 1
    });

    if (customers.data.length > 0) {
      return customers.data[0];
    }

    // Create new customer
    return await this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId
      }
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret || !this.stripe) {
      throw new Error('Webhook verification not configured');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret
    );
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event, handlers = {}) {
    const { type, data } = event;

    switch (type) {
      case 'checkout.session.completed':
        if (handlers.checkoutCompleted) {
          await handlers.checkoutCompleted(data.object);
        }
        break;

      case 'customer.subscription.created':
        if (handlers.subscriptionCreated) {
          await handlers.subscriptionCreated(data.object);
        }
        break;

      case 'customer.subscription.updated':
        if (handlers.subscriptionUpdated) {
          await handlers.subscriptionUpdated(data.object);
        }
        break;

      case 'customer.subscription.deleted':
        if (handlers.subscriptionDeleted) {
          await handlers.subscriptionDeleted(data.object);
        }
        break;

      case 'invoice.payment_succeeded':
        if (handlers.paymentSucceeded) {
          await handlers.paymentSucceeded(data.object);
        }
        break;

      case 'invoice.payment_failed':
        if (handlers.paymentFailed) {
          await handlers.paymentFailed(data.object);
        }
        break;

      default:
        console.log(`Unhandled webhook event: ${type}`);
    }
  }

  /**
   * Get plan by price ID
   */
  getPlanByPriceId(priceId) {
    for (const [planKey, planConfig] of Object.entries(PLANS)) {
      if (planConfig.priceId === priceId) {
        return { key: planKey, ...planConfig };
      }
    }
    return null;
  }

  /**
   * Get plan configuration
   */
  getPlan(planKey) {
    return PLANS[planKey] || null;
  }

  /**
   * List all available plans
   */
  listPlans() {
    return Object.entries(PLANS).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(customerId) {
    if (!this.stripe) {
      return false;
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    return subscriptions.data.length > 0;
  }

  /**
   * Get usage for metered billing (if needed)
   */
  async getUsage(subscriptionItemId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    return await this.stripe.subscriptionItems.listUsageRecordSummaries(
      subscriptionItemId,
      { limit: 10 }
    );
  }

  /**
   * Report usage for metered billing
   */
  async reportUsage(subscriptionItemId, quantity, timestamp = Date.now() / 1000) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    return await this.stripe.usageRecords.create({
      subscription_item: subscriptionItemId,
      quantity,
      timestamp: Math.floor(timestamp),
      action: 'increment'
    });
  }
}

module.exports = {
  StripeClient,
  PLANS
};
