export interface Payment {
  id: number;
  userId: number;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  type: 'subscription' | 'appointment' | 'service';
  referenceId: number;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  paymentMethod: 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer';
  paymentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPayment = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

export interface PaymentMethod {
  id: number;
  userId: number;
  type: 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer';
  isDefault: boolean;
  stripePaymentMethodId?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  bankName?: string;
  bankAccountType?: string;
  bankAccountLast4?: string;
  pixKey?: string;
  pixKeyType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPaymentMethod = Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>;

export interface PaymentRefund {
  id: number;
  paymentId: number;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
  stripeRefundId?: string;
  refundDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPaymentRefund = Omit<PaymentRefund, 'id' | 'createdAt' | 'updatedAt'>; 