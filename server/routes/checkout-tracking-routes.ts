import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

// Schema para criar registro de checkout
const createCheckoutSchema = z.object({
  checkoutType: z.enum(["subscription", "consultation", "service"]),
  amount: z.number().positive(),
  paymentMethod: z.enum(["card", "pix", "boleto"]).optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema para atualizar status do checkout
const updateCheckoutStatusSchema = z.object({
  status: z.enum([
    "processing",
    "completed",
    "failed",
    "abandoned",
    "payment_failed",
    "payment_expired"
  ]),
  paymentStatus: z.enum([
    "pending",
    "processing",
    "succeeded",
    "failed",
    "expired"
  ]).optional(),
  paymentError: z.string().optional(),
  stripePaymentIntentId: z.string().optional(),
  stripeSessionId: z.string().optional(),
  stripeErrorCode: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  abandonedAt: z.string().datetime().optional(),
});

// Criar novo registro de checkout
router.post("/checkout-tracking", authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const body = createCheckoutSchema.parse(req.body);
    
    // Capturar informações do cliente
    const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    const checkout = await prisma.$executeRaw`
      INSERT INTO checkout_tracking (
        user_id, 
        checkout_type, 
        amount, 
        payment_method,
        metadata,
        ip_address,
        user_agent,
        referrer
      ) VALUES (
        ${userId},
        ${body.checkoutType},
        ${body.amount},
        ${body.paymentMethod || null},
        ${JSON.stringify(body.metadata || {})}::jsonb,
        ${ipAddress},
        ${userAgent},
        ${referrer}
      ) RETURNING *
    `;

    res.json({ success: true, checkoutId: checkout });
  } catch (error) {
    console.error("Erro ao criar registro de checkout:", error);
    res.status(500).json({ error: "Erro ao registrar checkout" });
  }
});

// Atualizar status do checkout
router.patch("/checkout-tracking/:id", authenticateToken, async (req, res) => {
  try {
    const checkoutId = parseInt(req.params.id);
    const body = updateCheckoutStatusSchema.parse(req.body);
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Construir query dinamicamente baseado nos campos fornecidos
    if (body.status) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(body.status);
      paramIndex++;
    }

    if (body.paymentStatus) {
      updateFields.push(`payment_status = $${paramIndex}`);
      values.push(body.paymentStatus);
      paramIndex++;
    }

    if (body.paymentError) {
      updateFields.push(`payment_error = $${paramIndex}`);
      values.push(body.paymentError);
      paramIndex++;
    }

    if (body.stripePaymentIntentId) {
      updateFields.push(`stripe_payment_intent_id = $${paramIndex}`);
      values.push(body.stripePaymentIntentId);
      paramIndex++;
    }

    if (body.stripeSessionId) {
      updateFields.push(`stripe_session_id = $${paramIndex}`);
      values.push(body.stripeSessionId);
      paramIndex++;
    }

    if (body.stripeErrorCode) {
      updateFields.push(`stripe_error_code = $${paramIndex}`);
      values.push(body.stripeErrorCode);
      paramIndex++;
    }

    if (body.completedAt) {
      updateFields.push(`completed_at = $${paramIndex}`);
      values.push(new Date(body.completedAt));
      paramIndex++;
    }

    if (body.abandonedAt) {
      updateFields.push(`abandoned_at = $${paramIndex}`);
      values.push(new Date(body.abandonedAt));
      paramIndex++;
    }

    // Sempre atualizar last_activity_at
    updateFields.push(`last_activity_at = CURRENT_TIMESTAMP`);

    values.push(checkoutId);

    const query = `
      UPDATE checkout_tracking 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    await prisma.$executeRawUnsafe(query, ...values);

    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar checkout:", error);
    res.status(500).json({ error: "Erro ao atualizar checkout" });
  }
});

// Admin: Listar todos os checkouts com filtros
router.get("/admin/checkout-tracking", authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id }
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { status, paymentStatus, checkoutType, startDate, endDate, page = 1, limit = 20 } = req.query;

    let whereConditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`ct.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (paymentStatus) {
      whereConditions.push(`ct.payment_status = $${paramIndex}`);
      values.push(paymentStatus);
      paramIndex++;
    }

    if (checkoutType) {
      whereConditions.push(`ct.checkout_type = $${paramIndex}`);
      values.push(checkoutType);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`ct.created_at >= $${paramIndex}`);
      values.push(new Date(startDate as string));
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`ct.created_at <= $${paramIndex}`);
      values.push(new Date(endDate as string));
      paramIndex++;
    }

    const offset = (Number(page) - 1) * Number(limit);
    
    const query = `
      SELECT 
        ct.*,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        u.subscription_plan,
        u.subscription_status
      FROM checkout_tracking ct
      JOIN users u ON ct.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ct.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM checkout_tracking ct
      WHERE ${whereConditions.join(' AND ')}
    `;

    const [checkouts, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(query, ...values),
      prisma.$queryRawUnsafe(countQuery, ...values)
    ]);

    const total = Number((countResult as any)[0]?.total || 0);

    res.json({
      checkouts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("Erro ao listar checkouts:", error);
    res.status(500).json({ error: "Erro ao listar checkouts" });
  }
});

// Admin: Dashboard de métricas
router.get("/admin/checkout-tracking/metrics", authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id }
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const values: any[] = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE ct.created_at BETWEEN $1 AND $2';
      values.push(new Date(startDate as string), new Date(endDate as string));
    }

    // Métricas gerais
    const metricsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'initiated') as initiated_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_count,
        COUNT(*) FILTER (WHERE status IN ('failed', 'payment_failed')) as failed_count,
        COUNT(*) FILTER (WHERE status = 'payment_expired') as expired_count,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_transaction_value,
        COUNT(DISTINCT user_id) as unique_users
      FROM checkout_tracking ct
      ${dateFilter}
    `;

    // Taxa de conversão por tipo
    const conversionQuery = `
      SELECT 
        checkout_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as conversion_rate
      FROM checkout_tracking ct
      ${dateFilter}
      GROUP BY checkout_type
    `;

    // Pagamentos com problemas
    const problemPaymentsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE payment_status = 'failed') as payment_failed_count,
        COUNT(*) FILTER (WHERE payment_status = 'expired') as payment_expired_count,
        COUNT(*) FILTER (WHERE 
          status = 'abandoned' AND 
          last_activity_at < NOW() - INTERVAL '24 hours'
        ) as abandoned_24h_count
      FROM checkout_tracking ct
      ${dateFilter}
    `;

    const [metrics, conversionRates, problemPayments] = await Promise.all([
      prisma.$queryRawUnsafe(metricsQuery, ...values),
      prisma.$queryRawUnsafe(conversionQuery, ...values),
      prisma.$queryRawUnsafe(problemPaymentsQuery, ...values)
    ]);

    res.json({
      metrics: (metrics as any)[0],
      conversionRates,
      problemPayments: (problemPayments as any)[0]
    });
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    res.status(500).json({ error: "Erro ao buscar métricas" });
  }
});

// Admin: Listar usuários com pagamentos pendentes/atrasados
router.get("/admin/checkout-tracking/problem-users", authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id }
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const query = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.subscription_plan,
        u.subscription_status,
        COUNT(ct.id) as problem_checkouts_count,
        MAX(ct.created_at) as last_checkout_attempt,
        SUM(ct.amount) as total_amount_pending,
        array_agg(DISTINCT ct.status) as checkout_statuses,
        array_agg(DISTINCT ct.payment_status) as payment_statuses
      FROM users u
      JOIN checkout_tracking ct ON u.id = ct.user_id
      WHERE ct.status IN ('failed', 'payment_failed', 'payment_expired', 'abandoned')
        OR ct.payment_status IN ('failed', 'expired')
      GROUP BY u.id, u.name, u.email, u.phone, u.subscription_plan, u.subscription_status
      ORDER BY problem_checkouts_count DESC, last_checkout_attempt DESC
    `;

    const problemUsers = await prisma.$queryRawUnsafe(query);

    res.json({ problemUsers });
  } catch (error) {
    console.error("Erro ao listar usuários com problemas:", error);
    res.status(500).json({ error: "Erro ao listar usuários com problemas" });
  }
});

// Admin: Criar lembrete de pagamento
router.post("/admin/payment-reminders", authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id }
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { userId, checkoutTrackingId, reminderType, scheduledFor } = req.body;

    await prisma.$executeRaw`
      INSERT INTO payment_reminders (
        user_id,
        checkout_tracking_id,
        reminder_type,
        scheduled_for
      ) VALUES (
        ${userId},
        ${checkoutTrackingId || null},
        ${reminderType},
        ${new Date(scheduledFor)}
      )
    `;

    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao criar lembrete:", error);
    res.status(500).json({ error: "Erro ao criar lembrete" });
  }
});

export default router;