import { Dependent, InsertDependent } from '../../shared/schema';

export interface IDependentStorage {
  getDependent(id: number): Promise<Dependent | null>;
  getDependentsByUserId(userId: number): Promise<Dependent[]>;
  getDependentByCpf(cpf: string): Promise<Dependent | null>;
  createDependent(dependent: InsertDependent): Promise<Dependent>;
  updateDependent(id: number, dependent: Partial<InsertDependent>): Promise<Dependent | null>;
  deleteDependent(id: number): Promise<boolean>;
} 