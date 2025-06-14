import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { AppError } from '../utils/app-error';

const medicalRecordsRouter = Router();

// Log para debug
medicalRecordsRouter.use((req, res, next) => {
  console.log(`[Medical Records Router] ${req.method} ${req.path}`);
  next();
});

// Middleware para verificar se é médico ou admin
const requireDoctorOrAdmin = async (req: AuthenticatedRequest, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Não autorizado' });
  }
  
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso permitido apenas para médicos e administradores' });
  }
  
  next();
};

// Buscar prontuário por ID do paciente (médicos e admin)
medicalRecordsRouter.get('/patient/:patientId', requireAuth, requireDoctorOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);
    
    if (isNaN(patientId)) {
      return res.status(400).json({ message: 'ID do paciente inválido' });
    }
    
    // Verificar permissões
    if (req.user!.role === 'doctor') {
      const canAccess = await storage.canDoctorAccessMedicalRecord(req.user!.id, patientId);
      if (!canAccess) {
        return res.status(403).json({ message: 'Você não tem permissão para acessar este prontuário' });
      }
    }
    
    // Buscar ou criar prontuário
    let record = await storage.getMedicalRecordByPatientId(patientId);
    
    if (!record) {
      // Criar prontuário se não existir
      record = await storage.createMedicalRecord(patientId);
      console.log(`Prontuário criado para paciente ${patientId}: ${record.recordNumber}`);
    }
    
    // Registrar acesso
    await storage.logMedicalRecordAccess({
      recordId: record.id,
      userId: req.user!.id,
      accessType: 'view',
      accessReason: req.body.reason || 'Visualização de prontuário',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    // Buscar dados do paciente
    const patient = await storage.getUser(patientId);
    
    res.json({
      record,
      patient
    });
    
  } catch (error) {
    console.error('Erro ao buscar prontuário:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar prontuário',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Buscar entradas do prontuário
medicalRecordsRouter.get('/:recordId/entries', requireAuth, requireDoctorOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recordId = parseInt(req.params.recordId);
    
    if (isNaN(recordId)) {
      return res.status(400).json({ message: 'ID do prontuário inválido' });
    }
    
    // Buscar prontuário
    const record = await storage.getMedicalRecord(recordId);
    if (!record) {
      return res.status(404).json({ message: 'Prontuário não encontrado' });
    }
    
    // Verificar permissões para médico
    if (req.user!.role === 'doctor') {
      const canAccess = await storage.canDoctorAccessMedicalRecord(req.user!.id, record.patientId);
      if (!canAccess) {
        return res.status(403).json({ message: 'Você não tem permissão para acessar este prontuário' });
      }
    }
    
    // Buscar entradas
    const entries = await storage.getMedicalRecordEntries(recordId);
    
    res.json(entries);
    
  } catch (error) {
    console.error('Erro ao buscar entradas do prontuário:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar entradas do prontuário',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Adicionar entrada no prontuário (apenas médicos)
medicalRecordsRouter.post('/:recordId/entries', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'doctor') {
      return res.status(403).json({ message: 'Apenas médicos podem adicionar entradas no prontuário' });
    }
    
    const recordId = parseInt(req.params.recordId);
    
    if (isNaN(recordId)) {
      return res.status(400).json({ message: 'ID do prontuário inválido' });
    }
    
    // Buscar prontuário
    const record = await storage.getMedicalRecord(recordId);
    if (!record) {
      return res.status(404).json({ message: 'Prontuário não encontrado' });
    }
    
    // Verificar permissões
    const canAccess = await storage.canDoctorAccessMedicalRecord(req.user!.id, record.patientId);
    if (!canAccess) {
      return res.status(403).json({ message: 'Você não tem permissão para adicionar entradas neste prontuário' });
    }
    
    const {
      appointmentId,
      entryType,
      content,
      subjective,
      objective,
      assessment,
      plan,
      vitalSigns,
      cid10,
      procedures,
      prescriptions,
      attachments
    } = req.body;
    
    // Validar dados obrigatórios
    if (!entryType || !content) {
      return res.status(400).json({ message: 'Tipo de entrada e conteúdo são obrigatórios' });
    }
    
    // Adicionar entrada
    const entry = await storage.addMedicalRecordEntry({
      recordId,
      appointmentId: appointmentId || null,
      authorId: req.user!.id,
      entryType,
      content,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
      vitalSigns: vitalSigns || null,
      cid10: cid10 || null,
      procedures: procedures || null,
      prescriptions: prescriptions || null,
      attachments: attachments || null,
      ipAddress: req.ip || null,
      createdAt: new Date()
    });
    
    // Registrar acesso
    await storage.logMedicalRecordAccess({
      recordId,
      userId: req.user!.id,
      accessType: 'create_entry',
      accessReason: `Adicionada entrada tipo: ${entryType}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    res.status(201).json(entry);
    
  } catch (error) {
    console.error('Erro ao adicionar entrada no prontuário:', error);
    return res.status(500).json({ 
      message: 'Erro ao adicionar entrada no prontuário',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Buscar pacientes do médico
medicalRecordsRouter.get('/doctor/patients', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  console.log('[Medical Records] GET /doctor/patients chamado');
  
  try {
    if (!req.user) {
      console.log('[Medical Records] Usuário não autenticado');
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }
    
    if (req.user.role !== 'doctor') {
      console.log(`[Medical Records] Usuário não é médico: ${req.user.role}`);
      return res.status(403).json({ message: 'Apenas médicos podem acessar esta rota' });
    }
    
    console.log(`[Medical Records] Buscando pacientes para médico user ID: ${req.user.id}, role: ${req.user.role}`);
    
    const patients = await storage.getDoctorPatients(req.user.id);
    
    console.log(`[Medical Records] Encontrados ${patients.length} pacientes`);
    console.log(`[Medical Records] Pacientes:`, patients.map(p => ({ id: p.id, name: p.fullName })));
    
    res.json(patients);
    
  } catch (error) {
    console.error('[Medical Records] Erro ao buscar pacientes do médico:', error);
    console.error('[Medical Records] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({ 
      message: 'Erro ao buscar pacientes',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Buscar prontuários (apenas admin)
medicalRecordsRouter.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Apenas administradores podem buscar prontuários' });
    }
    
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ message: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }
    
    const records = await storage.searchMedicalRecords(q.trim());
    
    // Registrar acesso para cada prontuário retornado
    for (const record of records) {
      await storage.logMedicalRecordAccess({
        recordId: record.id,
        userId: req.user!.id,
        accessType: 'view',
        accessReason: `Busca administrativa: ${q}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || ''
      });
    }
    
    res.json(records);
    
  } catch (error) {
    console.error('Erro ao buscar prontuários:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar prontuários',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Buscar histórico de acesso (admin)
medicalRecordsRouter.get('/:recordId/access-history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Apenas administradores podem ver histórico de acesso' });
    }
    
    const recordId = parseInt(req.params.recordId);
    
    if (isNaN(recordId)) {
      return res.status(400).json({ message: 'ID do prontuário inválido' });
    }
    
    const history = await storage.getMedicalRecordAccessHistory(recordId);
    
    res.json(history);
    
  } catch (error) {
    console.error('Erro ao buscar histórico de acesso:', error);
    return res.status(500).json({ 
      message: 'Erro ao buscar histórico de acesso',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default medicalRecordsRouter;