import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage';
import { Partner } from '@shared/schema';

describe('Storage Partners', () => {
  let testPartner: Partial<Partner>;

  beforeEach(() => {
    testPartner = {
      userId: 1,
      businessName: 'Parceiro Teste',
      cnpj: '12345678901234',
      address: 'Endereço Teste',
      phone: '11999999999',
      email: 'teste@teste.com',
      status: 'active'
    };
  });

  it('should create a partner', async () => {
    const createdPartner = await storage.createPartner(testPartner);
    expect(createdPartner).toBeDefined();
    expect(createdPartner.businessName).toBe(testPartner.businessName);
  });

  it('should get a partner by id', async () => {
    const createdPartner = await storage.createPartner(testPartner);
    const foundPartner = await storage.getPartner(createdPartner.id);
    expect(foundPartner).toBeDefined();
    expect(foundPartner?.businessName).toBe(testPartner.businessName);
  });

  it('should update a partner', async () => {
    const createdPartner = await storage.createPartner(testPartner);
    const updatedData = {
      businessName: 'Novo Parceiro',
      status: 'inactive'
    };
    const updatedPartner = await storage.updatePartner(createdPartner.id, updatedData);
    expect(updatedPartner.businessName).toBe(updatedData.businessName);
    expect(updatedPartner.status).toBe(updatedData.status);
  });

  it('should get all partners', async () => {
    const createdPartner = await storage.createPartner(testPartner);
    const partners = await storage.getAllPartners();
    expect(partners).toBeDefined();
    expect(partners.length).toBeGreaterThan(0);
    expect(partners.find(p => p.id === createdPartner.id)).toBeDefined();
  });

  it('should delete a partner', async () => {
    const createdPartner = await storage.createPartner(testPartner);
    await storage.deletePartner(createdPartner.id);
    const foundPartner = await storage.getPartner(createdPartner.id);
    expect(foundPartner).toBeUndefined();
  });
}); 