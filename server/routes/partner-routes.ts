import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/app-error';
import { upload } from '../middleware/upload';
import { db } from '../db';
import { users, partners } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

const partnerRouter = express.Router();

/**
 * Middleware para verificar se o usuário é um parceiro
 */
const requirePartner = (req: AuthenticatedRequest, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Acesso negado. Apenas parceiros podem acessar esta funcionalidade.' });
  }
  next();
};

/**
 * Obter parceiro pelo userId do usuário logado
 * GET /api/partners/me
 */
partnerRouter.get('/me', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const partner = await storage.getPartnerByUserId(req.user!.id);
    if (!partner) {
      return res.status(404).json({ error: 'Perfil de parceiro não encontrado' });
    }

    res.json(partner);
  } catch (error) {
    console.error('Erro ao obter dados do parceiro:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Obter serviços do parceiro logado
 * GET /api/partners/my-services
 */
partnerRouter.get('/my-services', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Primeiro, buscar o parceiro pelo userId
    const partner = await storage.getPartnerByUserId(req.user!.id);
    if (!partner) {
      return res.status(404).json({ error: 'Perfil de parceiro não encontrado' });
    }

    // Buscar apenas os serviços deste parceiro
    const services = await storage.getPartnerServicesByPartnerId(partner.id);
    
    res.json(services);
  } catch (error) {
    console.error('Erro ao buscar serviços do parceiro:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Criar um novo serviço para o parceiro logado
 * POST /api/partners/services
 */
partnerRouter.post('/services', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Primeiro, buscar o parceiro pelo userId
    const partner = await storage.getPartnerByUserId(req.user!.id);
    if (!partner) {
      return res.status(404).json({ error: 'Perfil de parceiro não encontrado' });
    }

    const { name, description, category, price, estimatedDuration } = req.body;

    // Validações básicas
    if (!name || !description || !category) {
      return res.status(400).json({ error: 'Nome, descrição e categoria são obrigatórios' });
    }

    const serviceData = {
      partnerId: partner.id,
      name,
      description,
      category,
      regularPrice: price || 0,
      discountPrice: price || 0,
      duration: estimatedDuration || null,
      isActive: true,
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newService = await storage.createPartnerService(serviceData);
    
    res.status(201).json(newService);
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualizar um serviço do parceiro logado
 * PUT /api/partners/services/:id
 */
partnerRouter.put('/services/:id', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: 'ID do serviço inválido' });
    }

    // Primeiro, buscar o parceiro pelo userId
    const partner = await storage.getPartnerByUserId(req.user!.id);
    if (!partner) {
      return res.status(404).json({ error: 'Perfil de parceiro não encontrado' });
    }

    // Verificar se o serviço existe e pertence ao parceiro
    const existingService = await storage.getPartnerService(serviceId);
    if (!existingService) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    if (existingService.partnerId !== partner.id) {
      return res.status(403).json({ error: 'Você só pode editar seus próprios serviços' });
    }

    const { name, description, category, price, estimatedDuration, isActive } = req.body;

    const updateData = {
      name: name || existingService.name,
      description: description || existingService.description,
      category: category || existingService.category,
      regularPrice: price !== undefined ? price : existingService.regularPrice,
      discountPrice: price !== undefined ? price : existingService.discountPrice,
      duration: estimatedDuration !== undefined ? estimatedDuration : existingService.duration,
      isActive: isActive !== undefined ? isActive : existingService.isActive,
      updatedAt: new Date()
    };

    const updatedService = await storage.updatePartnerService(serviceId, updateData);
    
    res.json(updatedService);
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Excluir um serviço do parceiro logado
 * DELETE /api/partners/services/:id
 */
partnerRouter.delete('/services/:id', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ error: 'ID do serviço inválido' });
    }

    // Primeiro, buscar o parceiro pelo userId
    const partner = await storage.getPartnerByUserId(req.user!.id);
    if (!partner) {
      return res.status(404).json({ error: 'Perfil de parceiro não encontrado' });
    }

    // Verificar se o serviço existe e pertence ao parceiro
    const existingService = await storage.getPartnerService(serviceId);
    if (!existingService) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    if (existingService.partnerId !== partner.id) {
      return res.status(403).json({ error: 'Você só pode excluir seus próprios serviços' });
    }

    await storage.deletePartnerService(serviceId);
    
    res.json({ message: 'Serviço excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir serviço:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Atualizar perfil do parceiro logado
 * PUT /api/partners/me
 */
partnerRouter.put('/me', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Primeiro, buscar o parceiro pelo userId
    const partner = await storage.getPartnerByUserId(req.user!.id);
    if (!partner) {
      return res.status(404).json({ error: 'Perfil de parceiro não encontrado' });
    }

    const { 
      businessName,
      businessType,
      tradingName, 
      description, 
      phone, 
      website, 
      address,
      zipcode,
      street,
      number,
      complement,
      neighborhood,
      city, 
      state, 
      postalCode,
      cnpj,
      nationwideService
    } = req.body;

    const updateData = {
      businessName: businessName || partner.businessName,
      businessType: businessType || partner.businessType,
      tradingName: tradingName || partner.tradingName,
      description: description || partner.description,
      phone: phone || partner.phone,
      website: website || partner.website,
      address: address || partner.address,
      zipcode: zipcode || partner.zipcode,
      street: street || partner.street,
      number: number || partner.number,
      complement: complement || partner.complement,
      neighborhood: neighborhood || partner.neighborhood,
      city: city || partner.city,
      state: state || partner.state,
      postalCode: postalCode || partner.postalCode,
      cnpj: cnpj || partner.cnpj,
      nationwideService: nationwideService !== undefined ? nationwideService : partner.nationwideService,
      updatedAt: new Date()
    };

    const updatedPartner = await storage.updatePartner(partner.id, updateData);
    
    res.json(updatedPartner);
  } catch (error) {
    console.error('Erro ao atualizar perfil do parceiro:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

/**
 * Upload de imagem de perfil do parceiro
 * POST /api/partners/profile-image
 */
partnerRouter.post('/profile-image', requireAuth, requirePartner, upload.single('profileImage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo foi enviado' 
      });
    }

    const userId = req.user!.id;
    const imageUrl = `/uploads/${req.file.filename}`;

    // Buscar parceiro atual
    const partner = await storage.getPartnerByUserId(userId);
    if (!partner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Perfil de parceiro não encontrado' 
      });
    }

    const oldImage = partner.profileImage;

    // Atualizar imagem no perfil do usuário
    await db
      .update(users)
      .set({ 
        profileImage: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Atualizar imagem no perfil do parceiro
    await storage.updatePartner(partner.id, {
      profileImage: imageUrl,
      updatedAt: new Date()
    });

    // Remover imagem antiga se existir
    if (oldImage && oldImage.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), 'public', oldImage);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log('Imagem antiga removida:', oldPath);
        } catch (error) {
          console.error('Erro ao remover imagem antiga:', error);
        }
      }
    }

    res.json({
      success: true,
      message: 'Foto de perfil do parceiro atualizada com sucesso',
      imageUrl,
      profileImage: imageUrl
    });

  } catch (error: any) {
    console.error('Erro ao fazer upload de imagem do parceiro:', error);
    
    // Remover arquivo se houve erro
    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * Remover imagem de perfil do parceiro
 * DELETE /api/partners/remove-profile-image
 */
partnerRouter.delete('/remove-profile-image', requireAuth, requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Buscar parceiro atual
    const partner = await storage.getPartnerByUserId(userId);
    if (!partner) {
      return res.status(404).json({ 
        success: false, 
        message: 'Perfil de parceiro não encontrado' 
      });
    }

    const oldImage = partner.profileImage;

    // Remover imagem do perfil do usuário
    await db
      .update(users)
      .set({ 
        profileImage: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Remover imagem do perfil do parceiro
    await storage.updatePartner(partner.id, {
      profileImage: null,
      updatedAt: new Date()
    });

    // Remover arquivo físico
    if (oldImage && oldImage.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), 'public', oldImage);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log('Imagem removida:', oldPath);
        } catch (error) {
          console.error('Erro ao remover arquivo:', error);
        }
      }
    }

    res.json({
      success: true,
      message: 'Foto de perfil do parceiro removida com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao remover imagem do parceiro:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

export default partnerRouter; 