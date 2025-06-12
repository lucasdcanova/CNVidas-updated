import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";

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

    const result = await db.execute(sql`
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
      ) RETURNING id
    `);

    const checkoutId = result.rows[0]?.id;
    res.json({ success: true, checkoutId });
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
    
    const updates: Record<string, any> = {};
    
    if (body.status) updates.status = body.status;
    if (body.paymentStatus) updates.payment_status = body.paymentStatus;
    if (body.paymentError) updates.payment_error = body.paymentError;
    if (body.stripePaymentIntentId) updates.stripe_payment_intent_id = body.stripePaymentIntentId;
    if (body.stripeSessionId) updates.stripe_session_id = body.stripeSessionId;
    if (body.stripeErrorCode) updates.stripe_error_code = body.stripeErrorCode;
    if (body.completedAt) updates.completed_at = new Date(body.completedAt);
    if (body.abandonedAt) updates.abandoned_at = new Date(body.abandonedAt);
    updates.last_activity_at = sql`CURRENT_TIMESTAMP`;

    const setClauses = Object.entries(updates).map(([key, value]) => 
      sql`${sql.identifier(key)} = ${value}`
    );

    await db.execute(sql`
      UPDATE checkout_tracking 
      SET ${sql.join(setClauses, sql`, `)}
      WHERE id = ${checkoutId}
    `);

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
    const user = await storage.getUserById(req.user?.id || 0);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { status, paymentStatus, checkoutType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const conditions = [];
    
    if (status) {
      conditions.push(sql`ct.status = ${status}`);
    }
    if (paymentStatus) {
      conditions.push(sql`ct.payment_status = ${paymentStatus}`);
    }
    if (checkoutType) {
      conditions.push(sql`ct.checkout_type = ${checkoutType}`);
    }
    if (startDate) {
      conditions.push(sql`ct.created_at >= ${new Date(startDate as string)}`);
    }
    if (endDate) {
      conditions.push(sql`ct.created_at <= ${new Date(endDate as string)}`);
    }

    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;

    const offset = (Number(page) - 1) * Number(limit);
    
    const checkoutsQuery = sql`
      SELECT 
        ct.*,
        u.full_name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        u.subscription_plan_id,
        u.subscription_status
      FROM checkout_tracking ct
      JOIN users u ON ct.user_id = u.id
      ${whereClause}
      ORDER BY ct.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;

    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM checkout_tracking ct
      ${whereClause}
    `;

    const [checkoutsResult, countResult] = await Promise.all([
      db.execute(checkoutsQuery),
      db.execute(countQuery)
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      checkouts: checkoutsResult.rows,
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
    const user = await storage.getUserById(req.user?.id || 0);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { startDate, endDate } = req.query;

    const conditions = [];
    if (startDate && endDate) {
      conditions.push(sql`ct.created_at BETWEEN ${new Date(startDate as string)} AND ${new Date(endDate as string)}`);
    }

    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;

    // Métricas gerais
    const metricsQuery = sql`
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
      ${whereClause}
    `;

    // Taxa de conversão por tipo
    const conversionQuery = sql`
      SELECT 
        checkout_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as conversion_rate
      FROM checkout_tracking ct
      ${whereClause}
      GROUP BY checkout_type
    `;

    // Pagamentos com problemas
    const problemPaymentsQuery = sql`
      SELECT 
        COUNT(*) FILTER (WHERE payment_status = 'failed') as payment_failed_count,
        COUNT(*) FILTER (WHERE payment_status = 'expired') as payment_expired_count,
        COUNT(*) FILTER (WHERE 
          status = 'abandoned' AND 
          last_activity_at < NOW() - INTERVAL '24 hours'
        ) as abandoned_24h_count
      FROM checkout_tracking ct
      ${whereClause}
    `;

    const [metricsResult, conversionResult, problemResult] = await Promise.all([
      db.execute(metricsQuery),
      db.execute(conversionQuery),
      db.execute(problemPaymentsQuery)
    ]);

    res.json({
      metrics: metricsResult.rows[0] || {},
      conversionRates: conversionResult.rows || [],
      problemPayments: problemResult.rows[0] || {}
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
    const user = await storage.getUserById(req.user?.id || 0);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const query = sql`
      SELECT DISTINCT
        u.id,
        u.full_name as name,
        u.email,
        u.phone,
        u.subscription_plan_id,
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
      GROUP BY u.id, u.full_name, u.email, u.phone, u.subscription_plan_id, u.subscription_status
      ORDER BY problem_checkouts_count DESC, last_checkout_attempt DESC
    `;

    const result = await db.execute(query);

    res.json({ problemUsers: result.rows });
  } catch (error) {
    console.error("Erro ao listar usuários com problemas:", error);
    res.status(500).json({ error: "Erro ao listar usuários com problemas" });
  }
});

// Admin: Criar lembrete de pagamento
router.post("/admin/payment-reminders", authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    const user = await storage.getUserById(req.user?.id || 0);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { userId, checkoutTrackingId, reminderType, scheduledFor } = req.body;

    await db.execute(sql`
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
    `);

    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao criar lembrete:", error);
    res.status(500).json({ error: "Erro ao criar lembrete" });
  }
});

export default router;