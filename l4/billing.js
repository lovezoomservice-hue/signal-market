/**
 * Billing System - Usage Tracking, Quota Management, and Billing Generation
 * Signal Market
 */

const { PLANS } = require('./stripe_client');

// In-memory storage (replace with database in production)
const userQuotas = new Map();
const usageRecords = new Map();
const invoices = new Map();

class BillingSystem {
  constructor(db = null) {
    this.db = db;
  }

  /**
   * Initialize quota for a new user
   */
  async initializeUser(userId, plan = 'free') {
    const planConfig = PLANS[plan];
    
    const quota = {
      userId,
      plan,
      planConfig,
      periodStart: this.getCurrentPeriodStart(),
      periodEnd: this.getCurrentPeriodEnd(),
      apiCallsUsed: 0,
      signalsUsed: 0,
      customStrategiesUsed: 0,
      webhookCallsUsed: 0,
      accountsUsed: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    userQuotas.set(userId, quota);
    
    // Initialize usage records for today
    const today = this.getTodayKey();
    usageRecords.set(`${userId}:${today}`, {
      apiCalls: 0,
      signals: 0,
      webhookCalls: 0,
      date: today
    });

    return quota;
  }

  /**
   * Get current quota for user
   */
  async getQuota(userId) {
    let quota = userQuotas.get(userId);
    
    if (!quota) {
      quota = await this.initializeUser(userId, 'free');
    }

    // Check if we need to reset for new period
    const now = new Date();
    if (now >= quota.periodEnd) {
      await this.resetQuotaPeriod(userId);
      quota = userQuotas.get(userId);
    }

    return quota;
  }

  /**
   * Check if user can use a feature
   */
  async checkQuota(userId, resourceType, amount = 1) {
    const quota = await this.getQuota(userId);
    const planConfig = quota.planConfig;

    const limits = {
      apiCalls: planConfig.apiCalls,
      signals: planConfig.signals,
      customStrategies: planConfig.customStrategies,
      webhookConcurrency: planConfig.webhookConcurrency,
      maxAccounts: planConfig.maxAccounts
    };

    const limit = limits[resourceType];
    
    if (limit === Infinity) {
      return { allowed: true, remaining: Infinity, quota };
    }

    const used = this.getUsedCount(quota, resourceType);
    const remaining = limit - used;

    return {
      allowed: remaining >= amount,
      remaining: Math.max(0, remaining),
      used,
      limit,
      quota
    };
  }

  /**
   * Record usage
   */
  async recordUsage(userId, resourceType, amount = 1) {
    const quota = await this.getQuota(userId);
    const check = await this.checkQuota(userId, resourceType, amount);

    if (!check.allowed) {
      throw new Error(`Quota exceeded for ${resourceType}. Remaining: ${check.remaining}`);
    }

    // Update quota
    const today = this.getTodayKey();
    const todayKey = `${userId}:${today}`;
    
    let todayUsage = usageRecords.get(todayKey);
    if (!todayUsage) {
      todayUsage = { apiCalls: 0, signals: 0, webhookCalls: 0, date: today };
      usageRecords.set(todayKey, todayUsage);
    }

    // Increment usage
    const resourceMap = {
      apiCalls: 'apiCalls',
      signals: 'signals',
      webhookCalls: 'webhookCalls'
    };

    const todayField = resourceMap[resourceType];
    if (todayField) {
      todayUsage[todayField] += amount;
    }

    // Update main quota
    quota[`${resourceType}Used`] = (quota[`${resourceType}Used`] || 0) + amount;
    quota.updatedAt = new Date().toISOString();

    userQuotas.set(userId, quota);
    usageRecords.set(todayKey, todayUsage);

    return {
      success: true,
      used: this.getUsedCount(quota, resourceType),
      remaining: check.remaining
    };
  }

  /**
   * Get usage for current period
   */
  async getCurrentUsage(userId) {
    const quota = await this.getQuota(userId);
    
    return {
      plan: quota.plan,
      periodStart: quota.periodStart,
      periodEnd: quota.periodEnd,
      apiCalls: {
        used: quota.apiCallsUsed,
        limit: quota.planConfig.apiCalls,
        remaining: this.calculateRemaining(quota.planConfig.apiCalls, quota.apiCallsUsed)
      },
      signals: {
        used: quota.signalsUsed,
        limit: quota.planConfig.signals,
        remaining: this.calculateRemaining(quota.planConfig.signals, quota.signalsUsed)
      },
      customStrategies: {
        used: quota.customStrategiesUsed,
        limit: quota.planConfig.customStrategies,
        remaining: this.calculateRemaining(quota.planConfig.customStrategies, quota.customStrategiesUsed)
      },
      webhookCalls: {
        used: quota.webhookCallsUsed,
        limit: quota.planConfig.webhookConcurrency,
        remaining: this.calculateRemaining(quota.planConfig.webhookConcurrency, quota.webhookCallsUsed)
      },
      accounts: {
        used: quota.accountsUsed,
        limit: quota.planConfig.maxAccounts,
        remaining: this.calculateRemaining(quota.planConfig.maxAccounts, quota.accountsUsed)
      }
    };
  }

  /**
   * Get daily usage breakdown
   */
  async getDailyUsage(userId, days = 30) {
    const records = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = this.getDateKey(date);
      const record = usageRecords.get(`${userId}:${dateKey}`);
      
      records.push({
        date: dateKey,
        apiCalls: record?.apiCalls || 0,
        signals: record?.signals || 0,
        webhookCalls: record?.webhookCalls || 0
      });
    }

    return records;
  }

  /**
   * Upgrade user plan
   */
  async upgradePlan(userId, newPlan) {
    const planConfig = PLANS[newPlan];
    if (!planConfig) {
      throw new Error(`Invalid plan: ${newPlan}`);
    }

    const quota = await this.getQuota(userId);
    quota.plan = newPlan;
    quota.planConfig = planConfig;
    quota.updatedAt = new Date().toISOString();

    userQuotas.set(userId, quota);

    return {
      success: true,
      plan: newPlan,
      quota
    };
  }

  /**
   * Generate invoice
   */
  async generateInvoice(userId, periodStart, periodEnd) {
    const quota = await this.getQuota(userId);
    const planConfig = PLANS[quota.plan];

    if (!planConfig.price || planConfig.price === 0) {
      return null; // No invoice for free plan
    }

    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      plan: quota.plan,
      periodStart,
      periodEnd,
      amount: planConfig.price,
      currency: 'CNY',
      status: 'pending',
      items: [{
        description: `${planConfig.name} Plan - Monthly Subscription`,
        amount: planConfig.price
      }],
      createdAt: new Date().toISOString()
    };

    const invoiceKey = `${userId}:${periodStart}:${periodEnd}`;
    invoices.set(invoiceKey, invoice);

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId) {
    for (const invoice of invoices.values()) {
      if (invoice.id === invoiceId) {
        return invoice;
      }
    }
    return null;
  }

  /**
   * Get user's invoices
   */
  async getUserInvoices(userId, limit = 12) {
    const userInvoices = [];
    
    for (const invoice of invoices.values()) {
      if (invoice.userId === userId) {
        userInvoices.push(invoice);
      }
    }

    return userInvoices
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(invoiceId, paymentMethod = 'stripe') {
    for (const [key, invoice] of invoices.entries()) {
      if (invoice.id === invoiceId) {
        invoice.status = 'paid';
        invoice.paidAt = new Date().toISOString();
        invoice.paymentMethod = paymentMethod;
        invoices.set(key, invoice);
        return invoice;
      }
    }
    return null;
  }

  /**
   * Check if user is on paid plan
   */
  async isPaidUser(userId) {
    const quota = await this.getQuota(userId);
    return quota.plan !== 'free' && quota.planConfig.price > 0;
  }

  /**
   * Get plan details
   */
  getPlanDetails(planKey) {
    return PLANS[planKey] || null;
  }

  /**
   * Calculate overage charges
   */
  async calculateOverage(userId, resourceType) {
    const quota = await this.getQuota(userId);
    const usage = await this.getCurrentUsage(userId);
    
    const overageConfig = {
      apiCalls: { rate: 0.001, unit: 'per call' }, // 0.001 CNY per call
      signals: { rate: 5, unit: 'per signal/month' },
      webhookCalls: { rate: 0.01, unit: 'per call' }
    };

    const config = overageConfig[resourceType];
    if (!config) return null;

    const usageData = usage[resourceType];
    if (!usageData || usageData.remaining >= 0) {
      return { overage: 0, rate: config.rate, unit: config.unit };
    }

    const overage = Math.abs(usageData.remaining);
    const charge = overage * config.rate;

    return {
      overage,
      charge,
      rate: config.rate,
      unit: config.unit
    };
  }

  // Helper methods

  getCurrentPeriodStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  getCurrentPeriodEnd() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return new Date(nextMonth.getTime() - 1).toISOString();
  }

  getTodayKey() {
    return this.getDateKey(new Date());
  }

  getDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  getUsedCount(quota, resourceType) {
    return quota[`${resourceType}Used`] || 0;
  }

  calculateRemaining(limit, used) {
    if (limit === Infinity) return Infinity;
    return Math.max(0, limit - used);
  }

  async resetQuotaPeriod(userId) {
    const quota = await this.getQuota(userId);
    
    // Archive old usage if needed
    // Reset counters
    quota.apiCallsUsed = 0;
    quota.signalsUsed = 0;
    quota.customStrategiesUsed = 0;
    quota.webhookCallsUsed = 0;
    
    // Update period
    quota.periodStart = this.getCurrentPeriodStart();
    quota.periodEnd = this.getCurrentPeriodEnd();
    quota.updatedAt = new Date().toISOString();

    userQuotas.set(userId, quota);

    // Reset today's usage
    const today = this.getTodayKey();
    usageRecords.set(`${userId}:${today}`, {
      apiCalls: 0,
      signals: 0,
      webhookCalls: 0,
      date: today
    });
  }
}

module.exports = {
  BillingSystem,
  PLANS
};
