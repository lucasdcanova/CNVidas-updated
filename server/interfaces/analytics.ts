export interface PageView {
  id: number;
  userId?: number;
  path: string;
  query?: string;
  referrer?: string;
  userAgent: string;
  ipAddress: string;
  sessionId: string;
  timestamp: Date;
}

export type InsertPageView = Omit<PageView, 'id'>;

export interface UserEvent {
  id: number;
  userId?: number;
  type: 'click' | 'submit' | 'search' | 'scroll' | 'hover' | 'download' | 'share';
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export type InsertUserEvent = Omit<UserEvent, 'id'>;

export interface AnalyticsReport {
  id: number;
  name: string;
  description: string;
  type: 'pageviews' | 'events' | 'users' | 'conversion' | 'custom';
  metrics: string[];
  dimensions: string[];
  filters?: {
    startDate?: Date;
    endDate?: Date;
    userIds?: number[];
    eventTypes?: string[];
    categories?: string[];
  };
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    recipients: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export type InsertAnalyticsReport = Omit<AnalyticsReport, 'id' | 'createdAt' | 'updatedAt'>;

export interface AnalyticsExport {
  id: number;
  reportId: number;
  userId: number;
  format: 'csv' | 'pdf' | 'excel';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type InsertAnalyticsExport = Omit<AnalyticsExport, 'id' | 'createdAt' | 'completedAt'>;

export interface ConversionGoal {
  id: number;
  name: string;
  description: string;
  type: 'pageview' | 'event' | 'duration' | 'pages_per_session';
  target: string;
  value?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertConversionGoal = Omit<ConversionGoal, 'id' | 'createdAt' | 'updatedAt'>; 