import { User, Dependent, Partner, AuditLog } from '../shared/schema';

declare global {
  namespace PrismaJson {
    type User = User;
    type Dependent = Dependent;
    type Partner = Partner;
    type AuditLog = AuditLog;
  }
}

declare module '@prisma/client' {
  interface PrismaClient {
    user: {
      findUnique: (args: any) => Promise<User | null>;
      findMany: (args: any) => Promise<User[]>;
      create: (args: any) => Promise<User>;
      update: (args: any) => Promise<User>;
      delete: (args: any) => Promise<User>;
    };
    dependent: {
      findUnique: (args: any) => Promise<Dependent | null>;
      findMany: (args: any) => Promise<Dependent[]>;
      create: (args: any) => Promise<Dependent>;
      update: (args: any) => Promise<Dependent>;
      delete: (args: any) => Promise<Dependent>;
    };
    partner: {
      findUnique: (args: any) => Promise<Partner | null>;
      findMany: (args: any) => Promise<Partner[]>;
      create: (args: any) => Promise<Partner>;
      update: (args: any) => Promise<Partner>;
      delete: (args: any) => Promise<Partner>;
    };
    auditLog: {
      findUnique: (args: any) => Promise<AuditLog | null>;
      findMany: (args: any) => Promise<AuditLog[]>;
      create: (args: any) => Promise<AuditLog>;
      update: (args: any) => Promise<AuditLog>;
      delete: (args: any) => Promise<AuditLog>;
    };
    appointment: any;
    doctor: any;
    subscription: any;
  }
} 