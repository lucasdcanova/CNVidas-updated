#!/usr/bin/env node

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { eq, desc } from "drizzle-orm";
import { users, subscriptionPlans, userSubscriptions } from "./shared/schema";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuração básica do WebSocket para Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configurando o pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1
});

// Inicialização da instância Drizzle
const db = drizzle(pool);

async function checkAndFixSubscriptionSync() {
  console.log("🔍 Verificando sincronização de planos de assinatura...\n");

  try {
    // Buscar todos os usuários pacientes
    const patients = await db.select()
      .from(users)
      .where(eq(users.role, 'patient'));

    console.log(`📊 Total de pacientes encontrados: ${patients.length}`);

    let fixedCount = 0;
    let problemCount = 0;

    for (const patient of patients) {
      console.log(`\n👤 Verificando paciente: ${patient.fullName} (${patient.email})`);
      console.log(`   - Plano na tabela users: ${patient.subscriptionPlan}`);
      console.log(`   - Status na tabela users: ${patient.subscriptionStatus}`);

      // Buscar a assinatura ativa mais recente do usuário
      const userSubscription = await db
        .select({
          subscription: userSubscriptions,
          plan: subscriptionPlans
        })
        .from(userSubscriptions)
        .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(eq(userSubscriptions.userId, patient.id))
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(1);

      if (userSubscription.length > 0) {
        const subscription = userSubscription[0];
        const actualPlan = subscription.plan?.name || 'free';
        const actualStatus = subscription.subscription.status;

        console.log(`   - Plano na tabela userSubscriptions: ${actualPlan}`);
        console.log(`   - Status na tabela userSubscriptions: ${actualStatus}`);

        // Verificar se há inconsistência
        if (patient.subscriptionPlan !== actualPlan || patient.subscriptionStatus !== actualStatus) {
          problemCount++;
          console.log(`   ❌ INCONSISTÊNCIA DETECTADA!`);
          console.log(`      Corrigindo: ${patient.subscriptionPlan} → ${actualPlan}`);
          console.log(`      Status: ${patient.subscriptionStatus} → ${actualStatus}`);

          // Corrigir a inconsistência
          await db.update(users)
            .set({
              subscriptionPlan: actualPlan,
              subscriptionStatus: actualStatus,
              updatedAt: new Date()
            })
            .where(eq(users.id, patient.id));

          fixedCount++;
          console.log(`   ✅ Corrigido com sucesso!`);
        } else {
          console.log(`   ✅ Dados sincronizados corretamente`);
        }
      } else {
        // Se não há assinatura na tabela userSubscriptions
        console.log(`   ⚠️  Nenhuma assinatura encontrada na tabela userSubscriptions`);
        
        // Se o usuário tem um plano diferente de 'free' mas não tem registro em userSubscriptions
        if (patient.subscriptionPlan && patient.subscriptionPlan !== 'free') {
          problemCount++;
          console.log(`   ❌ INCONSISTÊNCIA: Usuário tem plano ${patient.subscriptionPlan} mas sem registro em userSubscriptions`);
          
          // Buscar o plano correspondente
          const [plan] = await db.select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.name, patient.subscriptionPlan));
          
          if (plan) {
            console.log(`   🔧 Criando registro de assinatura para o plano ${plan.name}`);
            
            // Criar registro na tabela userSubscriptions
            await db.insert(userSubscriptions).values({
              userId: patient.id,
              planId: plan.id,
              status: patient.subscriptionStatus || 'active',
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
              paymentMethod: 'card',
              price: plan.price
            });
            
            fixedCount++;
            console.log(`   ✅ Registro de assinatura criado com sucesso!`);
          } else {
            console.log(`   ⚠️  Plano ${patient.subscriptionPlan} não encontrado na tabela subscriptionPlans`);
          }
        }
      }
    }

    console.log("\n📊 RESUMO DA VERIFICAÇÃO:");
    console.log(`   - Total de pacientes verificados: ${patients.length}`);
    console.log(`   - Inconsistências encontradas: ${problemCount}`);
    console.log(`   - Registros corrigidos: ${fixedCount}`);

    // Verificar especificamente o usuário Lucas Dickel Canova
    console.log("\n🔍 Verificando especificamente Lucas Dickel Canova...");
    const [lucas] = await db.select()
      .from(users)
      .where(eq(users.email, 'lucas@imanage-llc.com'));

    if (lucas) {
      console.log(`\n👤 Lucas Dickel Canova:`);
      console.log(`   - Plano atual: ${lucas.subscriptionPlan}`);
      console.log(`   - Status: ${lucas.subscriptionStatus}`);
      
      const lucasSubscription = await db
        .select({
          subscription: userSubscriptions,
          plan: subscriptionPlans
        })
        .from(userSubscriptions)
        .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(eq(userSubscriptions.userId, lucas.id))
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(1);

      if (lucasSubscription.length > 0) {
        console.log(`   - Assinatura encontrada: ${lucasSubscription[0].plan?.name} (${lucasSubscription[0].subscription.status})`);
      } else {
        console.log(`   - Nenhuma assinatura encontrada na tabela userSubscriptions`);
      }
    }

  } catch (error) {
    console.error("❌ Erro ao verificar/corrigir sincronização:", error);
  } finally {
    await pool.end();
    console.log("\n✅ Processo concluído");
  }
}

// Execute the fix
checkAndFixSubscriptionSync();