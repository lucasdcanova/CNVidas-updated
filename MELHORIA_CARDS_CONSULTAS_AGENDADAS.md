# Melhoria dos Cards de Consultas Agendadas - CN Vidas

## Problema Identificado

Na página de telemedicina (`/telemedicine`), os cards de consultas agendadas estavam mostrando apenas "Médico" em vez do nome real do médico, sem foto, especialidade ou informações de preço.

## Solução Implementada

### 🔧 **Backend - Melhorias no Storage**

#### 1. Nova Função com JOIN
Criada função `getUpcomingAppointmentsWithDoctorInfo()` no `server/storage.ts`:

```typescript
async getUpcomingAppointmentsWithDoctorInfo(userId: number): Promise<any[]> {
  const now = new Date();
  const result = await this.db.select({
    // Dados do appointment
    id: appointments.id,
    userId: appointments.userId,
    doctorId: appointments.doctorId,
    date: appointments.date,
    duration: appointments.duration,
    status: appointments.status,
    notes: appointments.notes,
    type: appointments.type,
    isEmergency: appointments.isEmergency,
    telemedRoomName: appointments.telemedRoomName,
    createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt,
    // Dados do médico
    doctorName: users.fullName,
    doctorEmail: users.email,
    doctorProfileImage: doctors.profileImage,
    specialization: doctors.specialization,
    consultationFee: doctors.consultationFee,
    availableForEmergency: doctors.availableForEmergency
  })
  .from(appointments)
  .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
  .leftJoin(users, eq(doctors.userId, users.id))
  .where(
    and(
      eq(appointments.userId, userId),
      gte(appointments.date, now)
    )
  )
  .orderBy(asc(appointments.date));
  
  return result;
}
```

#### 2. Atualização da Rota
Modificada rota `/api/appointments/upcoming` em `server/routes/appointment-join.ts`:

```typescript
// Buscar consultas próximas do usuário com dados completos do médico
const upcomingAppointments = await storage.getUpcomingAppointmentsWithDoctorInfo(userId);
```

### 🎨 **Frontend - Redesign dos Cards**

#### 1. Atualização do Tipo Appointment
Expandido o tipo `Appointment` em `client/src/pages/telemedicine-page.tsx`:

```typescript
type Appointment = {
  id: number;
  userId: number;
  doctorId: number;
  doctorName: string;
  doctorEmail?: string;
  doctorProfileImage?: string;
  specialization: string;
  consultationFee?: number;
  availableForEmergency?: boolean;
  date: string;
  duration: number;
  status: string;
  notes?: string;
  type?: string;
  isEmergency?: boolean;
};
```

#### 2. Redesign Completo dos Cards
Implementado novo layout com:

```typescript
{upcomingAppointments.map((appointment: Appointment) => {
  const priceInfo = getScheduledConsultationPriceInfo({
    consultationFee: appointment.consultationFee,
    availableForEmergency: appointment.availableForEmergency
  } as Doctor);
  
  return (
    <li key={appointment.id} className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-4">
        {/* Foto do médico */}
        <div className="flex-shrink-0">
          <Avatar className="h-12 w-12 border-2 border-white shadow-md ring-2 ring-blue-100">
            <AvatarImage 
              src={appointment.doctorProfileImage} 
              alt={appointment.doctorName}
              className="object-cover w-full h-full"
            />
            <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white text-sm font-semibold">
              {appointment.doctorName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'MD'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        {/* Informações da consulta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {formatDoctorName(appointment.doctorName)}
              </p>
              <p className="text-xs text-primary font-medium mt-0.5">
                {appointment.specialization}
              </p>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <p>
                  {format(new Date(appointment.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {/* Informação de preço */}
              <div className="mt-1">
                <span className={`text-xs ${priceInfo.color} font-medium`}>
                  {priceInfo.text}
                </span>
              </div>
            </div>
            
            {/* Badge de preço e botão */}
            <div className="ml-3 flex flex-col items-end space-y-2">
              <div className="flex-shrink-0">
                {priceInfo.badge}
              </div>
              <Button 
                size="sm" 
                variant="default"
                className="text-xs px-3 py-1 h-7"
                onClick={() => navigate(`/telemedicine/${appointment.id}`)}
              >
                Entrar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
})}
```

## 🎯 **Funcionalidades Implementadas**

### ✅ **Foto do Médico**
- Avatar com foto real do médico (`doctorProfileImage`)
- Fallback com iniciais do nome em caso de ausência de foto
- Design responsivo com bordas e sombras

### ✅ **Nome Completo do Médico**
- Formatação automática com "Dr." ou "Dra." baseado no gênero
- Função `formatDoctorName()` aplicada consistentemente
- Truncamento para nomes longos

### ✅ **Especialidade Médica**
- Exibição da especialidade do médico
- Estilização com cor primária para destaque
- Fonte menor e peso médio para hierarquia visual

### ✅ **Informações de Preço**
- Integração com `getScheduledConsultationPriceInfo()`
- Badge visual com cor baseada no tipo de consulta
- Texto explicativo sobre cobertura do plano
- Cores diferenciadas:
  - Verde: Coberto pelo plano
  - Azul: Valor com desconto
  - Laranja: Valor integral

### ✅ **Layout Responsivo**
- Design flexível que se adapta a diferentes tamanhos
- Espaçamento consistente e profissional
- Transições suaves no hover
- Organização hierárquica das informações

### ✅ **Data e Hora**
- Formatação em português brasileiro
- Ícone de calendário para identificação visual
- Formato: "dd de MMMM às HH:mm"

## 🔄 **Fluxo de Dados**

1. **Backend**: JOIN entre `appointments`, `doctors` e `users`
2. **API**: Retorna dados completos via `/api/appointments/upcoming`
3. **Frontend**: Recebe e processa dados enriquecidos
4. **UI**: Renderiza cards com informações completas

## 📊 **Antes vs Depois**

### ❌ **Antes**
- Apenas texto "Médico"
- Sem foto ou avatar
- Sem especialidade
- Sem informações de preço
- Layout simples e pouco informativo

### ✅ **Depois**
- Nome completo formatado (Dr./Dra.)
- Foto do médico com fallback elegante
- Especialidade médica destacada
- Informações de preço baseadas no plano
- Badge visual de preço
- Layout profissional e responsivo
- Transições suaves

## 🚀 **Benefícios**

### 👤 **Para o Paciente**
- Identificação clara do médico agendado
- Informações completas sobre a consulta
- Transparência sobre custos
- Interface mais profissional e confiável

### 💼 **Para o Negócio**
- Maior profissionalismo da plataforma
- Melhor experiência do usuário
- Informações claras sobre preços
- Redução de dúvidas e suporte

### 🔧 **Para Desenvolvimento**
- Código mais organizado e reutilizável
- Tipos TypeScript bem definidos
- Separação clara entre backend e frontend
- Facilita futuras melhorias

## 📝 **Arquivos Modificados**

1. **`server/storage.ts`**
   - Adicionada função `getUpcomingAppointmentsWithDoctorInfo()`
   - Atualizada interface `IStorage`

2. **`server/routes/appointment-join.ts`**
   - Modificada rota `/api/appointments/upcoming`

3. **`client/src/pages/telemedicine-page.tsx`**
   - Atualizado tipo `Appointment`
   - Redesenhados cards de consultas agendadas
   - Integração com funções de preço

## 🎨 **Design System**

### Cores Utilizadas
- **Primary**: Azul da marca CN Vidas
- **Success**: Verde para consultas cobertas
- **Warning**: Laranja para valores integrais
- **Gray**: Tons de cinza para textos secundários

### Componentes
- **Avatar**: Foto do médico com fallback
- **Badge**: Indicador visual de preço
- **Button**: Ação de entrar na consulta
- **Card**: Container principal das informações

### Tipografia
- **Semibold**: Nome do médico (destaque principal)
- **Medium**: Especialidade e preços
- **Regular**: Informações secundárias

## 🔮 **Próximas Melhorias Sugeridas**

1. **Status da Consulta**: Badge visual do status (agendada, confirmada, etc.)
2. **Notificações**: Indicador de novas mensagens do médico
3. **Avaliações**: Sistema de rating do médico
4. **Histórico**: Link para consultas anteriores com o mesmo médico
5. **Reagendamento**: Opção rápida para reagendar
6. **Cancelamento**: Opção de cancelar com política clara

---

**Data da Implementação:** 15/01/2025  
**Status:** ✅ **Implementado e Testado**  
**Commit:** `ffc07bb` - Feature: Melhora cards de consultas agendadas com dados completos do médico

### 🎯 **Resultado Final**

Os cards de consultas agendadas agora exibem **informações completas e profissionais** em vez de apenas "Médico", proporcionando uma experiência muito mais rica e informativa para os pacientes da plataforma CN Vidas. 