import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { appointments, users, doctors, doctorPayments } from "../shared/schema";
import { eq, sql, and, desc, gte, lte, count, sum } from "drizzle-orm";
import { db } from "./db";
import { AuthenticatedRequest } from "./types/authenticated-request";

export const doctorFinanceRouter = Router();

// Middleware para verificar se o usuário é um médico
const isDoctor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  if (req.user.role !== "doctor") {
    return res.status(403).json({ message: "Acesso negado. Apenas médicos podem acessar esta rota." });
  }
  next();
};

// Atualizar informações de pagamento (PIX) do médico
doctorFinanceRouter.put("/payment-info", isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      pixKeyType: z.string().min(1, "Tipo de chave PIX obrigatório"),
      pixKey: z.string().min(1, "Chave PIX obrigatória"),
      bankName: z.string().min(1, "Nome do banco obrigatório"),
      accountType: z.string().min(1, "Tipo de conta obrigatório"),
    });
    const data = schema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    // Buscar o médico pelo userId
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    // Atualizar os dados do médico
    await db.update(doctors)
      .set({
        pixKeyType: data.pixKeyType,
        pixKey: data.pixKey,
        bankName: data.bankName,
        accountType: data.accountType,
        updatedAt: new Date()
      })
      .where(eq(doctors.id, doctor.id));
    // Retornar os dados atualizados
    const [updatedDoctor] = await db.select().from(doctors).where(eq(doctors.id, doctor.id));
    return res.status(200).json(updatedDoctor);
  } catch (error) {
    console.error("Erro ao atualizar informações de pagamento:", error);
    return res.status(500).json({ message: "Erro ao atualizar informações de pagamento" });
  }
});

// Buscar o extrato de pagamentos do médico
doctorFinanceRouter.get("/payments", isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Não autorizado" });
    // Buscar o médico pelo userId
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    // Buscar os pagamentos do médico
    const payments = await db.select().from(doctorPayments).where(eq(doctorPayments.doctorId, doctor.id)).orderBy(desc(doctorPayments.createdAt));
    return res.status(200).json(payments);
  } catch (error) {
    console.error("Erro ao buscar extrato de pagamentos:", error);
    return res.status(500).json({ message: "Erro ao buscar extrato de pagamentos" });
  }
});

// Calcular os valores devidos pelas consultas realizadas
doctorFinanceRouter.get("/calculate-earnings", isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Não autorizado" });
    // Buscar o médico pelo userId
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    // Buscar consultas realizadas pelo médico que não tenham pagamentos registrados
    const consultations = await db.select().from(appointments)
      .where(and(eq(appointments.doctorId, doctor.id), eq(appointments.status, "completed")))
      .orderBy(desc(appointments.date));
    // Calcular o valor devido por cada consulta
    const calculatedEarnings = await Promise.all(consultations.map(async (consultation) => {
      let amount = 0;
      // Consulta de emergência
      if (consultation.isEmergency && consultation.duration > 5) {
        amount = 5000; // R$50,00 em centavos
      } else if (!consultation.isEmergency) {
        // Buscar o plano do paciente
        const [patient] = await db.select().from(users).where(eq(users.id, consultation.userId));
        if (patient) {
          const consultationFee = doctor.consultationFee || 0;
          if (["basic", "basic_family"].includes(patient.subscriptionPlan)) {
            amount = Math.round(consultationFee * 0.7);
          } else if (["premium", "ultra", "premium_family", "ultra_family"].includes(patient.subscriptionPlan)) {
            amount = Math.round(consultationFee * 0.5);
          } else {
            amount = consultationFee;
          }
        }
      }
      return {
        consultationId: consultation.id,
        amount,
        date: consultation.date,
        isEmergency: consultation.isEmergency,
      };
    }));
    return res.status(200).json(calculatedEarnings);
  } catch (error) {
    console.error("Erro ao calcular ganhos:", error);
    return res.status(500).json({ message: "Erro ao calcular ganhos" });
  }
});

// Gerar relatório financeiro mensal
doctorFinanceRouter.get("/monthly-report", isDoctor, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Não autorizado" });
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: "Mês e ano são obrigatórios" });
    }
    // Buscar o médico pelo userId
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    if (!doctor) {
      return res.status(404).json({ message: "Médico não encontrado" });
    }
    // Calcular datas de início e fim do mês
    const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
    const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);
    // Buscar pagamentos do médico no período especificado
    const payments = await db.select().from(doctorPayments)
      .where(and(
        eq(doctorPayments.doctorId, doctor.id),
        gte(doctorPayments.createdAt, startDate),
        lte(doctorPayments.createdAt, endDate)
      ))
      .orderBy(desc(doctorPayments.createdAt));
    // Calcular estatísticas financeiras
    const [result] = await db.select({
      total: sum(doctorPayments.amount),
      pending: sum(sql`case when ${doctorPayments.status} = 'pending' then ${doctorPayments.amount} else 0 end`),
      paid: sum(sql`case when ${doctorPayments.status} = 'paid' then ${doctorPayments.amount} else 0 end`),
      paymentCount: count()
    })
      .from(doctorPayments)
      .where(and(
        eq(doctorPayments.doctorId, doctor.id),
        gte(doctorPayments.createdAt, startDate),
        lte(doctorPayments.createdAt, endDate)
      ));
    // Dados resumidos por tipo de consulta
    const emergencyConsultations = payments.filter(p => p.description && p.description.includes("emergência")).length;
    const regularConsultations = payments.filter(p => p.description && !p.description.includes("emergência")).length;
    return res.status(200).json({
      month: parseInt(month as string),
      year: parseInt(year as string),
      payments,
      summary: {
        totalPending: result.pending || 0,
        totalPaid: result.paid || 0,
        totalAmount: result.total || 0,
        emergencyConsultations,
        regularConsultations,
        totalConsultations: emergencyConsultations + regularConsultations
      }
    });
  } catch (error) {
    console.error("Erro ao gerar relatório mensal:", error);
    return res.status(500).json({ message: "Erro ao gerar relatório mensal" });
  }
});