export interface Notification {
  id: number;
  userId: number;
  type: 'appointment' | 'system' | 'payment' | 'emergency';
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertNotification = Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>;

export interface NotificationPreferences {
  id: number;
  userId: number;
  email: boolean;
  push: boolean;
  sms: boolean;
  appointmentReminders: boolean;
  paymentReminders: boolean;
  systemUpdates: boolean;
  emergencyAlerts: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertNotificationPreferences = Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>; 