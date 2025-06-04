export interface Subscription {
  id: number;
  userId: number;
  planId: number;
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertSubscription = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>;

export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId?: string;
  stripeProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertSubscriptionPlan = Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>;

export interface SubscriptionPayment {
  id: number;
  subscriptionId: number;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  paymentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertSubscriptionPayment = Omit<SubscriptionPayment, 'id' | 'createdAt' | 'updatedAt'>; 