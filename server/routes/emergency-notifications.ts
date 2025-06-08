import { storage } from "../storage";
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

// Store para rastrear chamadas de emergência ativas
const activeEmergencyCalls = new Map<string, {
  id: string;
  doctorId: number;
  patientId: number;
  patientName: string;
  patientProfileImage?: string;
  timestamp: string;
  roomUrl: string;
}>();

const emergencyNotificationsRouter = Router();

// Endpoint para médico verificar chamadas de emergência ativas
emergencyNotificationsRouter.get("/doctor/:doctorId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const doctorId = parseInt(req.params.doctorId);
    const activeCalls = [];

    // Filtrar chamadas para este médico
    for (const [callId, call] of activeEmergencyCalls) {
      if (call.doctorId === doctorId) {
        // Verificar se a chamada não é muito antiga (mais de 30 minutos)
        const callTime = new Date(call.timestamp).getTime();
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;

        if (now - callTime < thirtyMinutes) {
          activeCalls.push(call);
        } else {
          // Remover chamadas antigas
          activeEmergencyCalls.delete(callId);
        }
      }
    }

    res.json(activeCalls);

  } catch (error) {
    console.error("Erro ao buscar chamadas de emergência:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// Endpoint para paciente iniciar chamada de emergência
emergencyNotificationsRouter.post("/start", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { doctorId } = req.body;
      const patientId = authReq.user.id;

      // Buscar informações do paciente
      const patient = await storage.getUser(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Paciente não encontrado" });
      }

      // Criar ID único para a chamada
      const callId = `emergency-${doctorId}-${patientId}-${Date.now()}`;
      
      // Registrar chamada de emergência ativa
      activeEmergencyCalls.set(callId, {
        id: callId,
        doctorId: parseInt(doctorId),
        patientId: patientId,
        patientName: patient.fullName || patient.username,
        patientProfileImage: patient.profileImage || undefined,
        timestamp: new Date().toISOString(),
        roomUrl: `https://cnvidas.daily.co/doctor-${doctorId}-emergency`
      });

      console.log(`🚨 Nova chamada de emergência registrada: ${callId}`);
      
      res.json({ 
        success: true, 
        callId,
        message: "Chamada de emergência iniciada" 
      });

    } catch (error) {
      console.error("Erro ao iniciar chamada de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });



// Endpoint para remover/encerrar chamada de emergência
emergencyNotificationsRouter.delete("/:callId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({ message: "Não autorizado" });
      }

      const { callId } = req.params;
      
      if (activeEmergencyCalls.has(callId)) {
        activeEmergencyCalls.delete(callId);
        console.log(`🔚 Chamada de emergência encerrada: ${callId}`);
        res.json({ success: true, message: "Chamada encerrada" });
      } else {
        res.status(404).json({ message: "Chamada não encontrada" });
      }

    } catch (error) {
      console.error("Erro ao encerrar chamada de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

// Endpoint para listar todas as chamadas ativas (admin)
emergencyNotificationsRouter.get("/all", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || authReq.user.role !== 'admin') {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const allCalls = Array.from(activeEmergencyCalls.values());
      res.json(allCalls);

    } catch (error) {
      console.error("Erro ao listar chamadas de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

export default emergencyNotificationsRouter;