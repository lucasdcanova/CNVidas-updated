import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware para verificar se o usuário é médico
const isDoctorMiddleware = async (req: any, res: any, next: any) => {
  try {
    const userId = req.session.userId;
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { doctors: true }
    });

    if (!user || user.role !== 'doctor' || !user.doctors[0]) {
      return res.status(403).json({ error: 'Acesso negado. Apenas médicos podem acessar prontuários.' });
    }

    req.doctorId = user.doctors[0].id;
    req.doctorUserId = user.id;
    next();
  } catch (error) {
    console.error('Erro no middleware de médico:', error);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
};

// Listar prontuários do médico
router.get('/', isAuthenticated, isDoctorMiddleware, async (req, res) => {
  try {
    const doctorUserId = req.doctorUserId;
    const { status, patientId, page = 1, limit = 10 } = req.query;

    const where: any = {
      doctor_id: doctorUserId
    };

    if (status) {
      where.status = status;
    }

    if (patientId) {
      where.patient_id = parseInt(patientId as string);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      prisma.medical_records.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              full_name: true,
              cpf: true,
              birth_date: true
            }
          },
          appointments: {
            select: {
              id: true,
              date: true,
              type: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: offset
      }),
      prisma.medical_records.count({ where })
    ]);

    res.json({
      records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('Erro ao listar prontuários:', error);
    res.status(500).json({ error: 'Erro ao listar prontuários' });
  }
});

// Obter prontuário específico
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    const record = await prisma.medical_records.findFirst({
      where: {
        id: parseInt(id),
        OR: [
          { patient_id: userId },
          { doctor_id: userId }
        ]
      },
      include: {
        patient: {
          select: {
            id: true,
            full_name: true,
            cpf: true,
            birth_date: true,
            phone: true,
            email: true
          }
        },
        doctor: {
          select: {
            id: true,
            full_name: true,
            email: true,
            doctors: {
              select: {
                specialization: true,
                license_number: true
              }
            }
          }
        },
        appointments: true,
        consultation_recordings: {
          select: {
            transcription: true,
            ai_generated_notes: true
          }
        },
        medical_record_versions: {
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Prontuário não encontrado' });
    }

    res.json(record);
  } catch (error: any) {
    console.error('Erro ao obter prontuário:', error);
    res.status(500).json({ error: 'Erro ao obter prontuário' });
  }
});

// Obter prontuário por consulta
router.get('/by-appointment/:appointmentId', isAuthenticated, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.session.userId;

    const record = await prisma.medical_records.findFirst({
      where: {
        appointment_id: parseInt(appointmentId),
        OR: [
          { patient_id: userId },
          { doctor_id: userId }
        ]
      },
      include: {
        patient: {
          select: {
            id: true,
            full_name: true,
            cpf: true,
            birth_date: true
          }
        },
        appointments: true,
        consultation_recordings: {
          select: {
            transcription: true,
            ai_generated_notes: true
          }
        }
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Prontuário não encontrado' });
    }

    res.json(record);
  } catch (error: any) {
    console.error('Erro ao obter prontuário:', error);
    res.status(500).json({ error: 'Erro ao obter prontuário' });
  }
});

// Criar novo prontuário
router.post('/', isAuthenticated, isDoctorMiddleware, async (req, res) => {
  try {
    const doctorUserId = req.doctorUserId;
    const { appointmentId, patientId, content } = req.body;

    if (!content || !content.data) {
      return res.status(400).json({ error: 'Conteúdo do prontuário é obrigatório' });
    }

    // Verificar se a consulta existe e pertence ao médico
    let appointment;
    let finalPatientId = patientId;

    if (appointmentId) {
      appointment = await prisma.appointments.findFirst({
        where: {
          id: appointmentId,
          doctors: {
            user_id: doctorUserId
          }
        }
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Consulta não encontrada' });
      }

      finalPatientId = appointment.user_id;
    }

    if (!finalPatientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    // Verificar se já existe prontuário para esta consulta
    if (appointmentId) {
      const existingRecord = await prisma.medical_records.findFirst({
        where: { appointment_id: appointmentId }
      });

      if (existingRecord) {
        return res.status(400).json({ error: 'Já existe um prontuário para esta consulta' });
      }
    }

    // Criar prontuário
    const record = await prisma.medical_records.create({
      data: {
        patient_id: finalPatientId,
        doctor_id: doctorUserId,
        appointment_id: appointmentId || null,
        content,
        status: 'draft',
        ai_generated: false
      },
      include: {
        patient: {
          select: {
            id: true,
            full_name: true,
            cpf: true,
            birth_date: true
          }
        },
        appointments: true
      }
    });

    res.status(201).json(record);
  } catch (error: any) {
    console.error('Erro ao criar prontuário:', error);
    res.status(500).json({ error: 'Erro ao criar prontuário' });
  }
});

// Atualizar prontuário (apenas rascunhos)
router.put('/:id', isAuthenticated, isDoctorMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorUserId = req.doctorUserId;
    const { content } = req.body;

    if (!content || !content.data) {
      return res.status(400).json({ error: 'Conteúdo do prontuário é obrigatório' });
    }

    // Verificar se o prontuário existe e pertence ao médico
    const existingRecord = await prisma.medical_records.findFirst({
      where: {
        id: parseInt(id),
        doctor_id: doctorUserId
      }
    });

    if (!existingRecord) {
      return res.status(404).json({ error: 'Prontuário não encontrado' });
    }

    if (existingRecord.status === 'signed') {
      return res.status(400).json({ error: 'Prontuários assinados não podem ser editados' });
    }

    // Criar versão antes de atualizar
    const currentVersion = await prisma.medical_record_versions.count({
      where: { medical_record_id: existingRecord.id }
    });

    await prisma.medical_record_versions.create({
      data: {
        medical_record_id: existingRecord.id,
        content: existingRecord.content,
        edited_by: doctorUserId,
        version_number: currentVersion + 1
      }
    });

    // Atualizar prontuário
    const updatedRecord = await prisma.medical_records.update({
      where: { id: parseInt(id) },
      data: {
        content,
        updated_at: new Date()
      },
      include: {
        patient: {
          select: {
            id: true,
            full_name: true,
            cpf: true,
            birth_date: true
          }
        },
        appointments: true
      }
    });

    res.json(updatedRecord);
  } catch (error: any) {
    console.error('Erro ao atualizar prontuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar prontuário' });
  }
});

// Assinar prontuário digitalmente
router.post('/:id/sign', isAuthenticated, isDoctorMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorUserId = req.doctorUserId;

    // Verificar se o prontuário existe e pertence ao médico
    const record = await prisma.medical_records.findFirst({
      where: {
        id: parseInt(id),
        doctor_id: doctorUserId
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Prontuário não encontrado' });
    }

    if (record.status === 'signed') {
      return res.status(400).json({ error: 'Prontuário já foi assinado' });
    }

    // Gerar hash da assinatura
    const signatureData = {
      recordId: record.id,
      doctorId: doctorUserId,
      content: record.content,
      timestamp: new Date().toISOString()
    };

    const signatureHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('hex');

    // Atualizar prontuário como assinado
    const signedRecord = await prisma.medical_records.update({
      where: { id: parseInt(id) },
      data: {
        status: 'signed',
        signed_at: new Date(),
        signature_hash: signatureHash
      },
      include: {
        patient: {
          select: {
            id: true,
            full_name: true,
            cpf: true,
            birth_date: true
          }
        },
        appointments: true
      }
    });

    res.json(signedRecord);
  } catch (error: any) {
    console.error('Erro ao assinar prontuário:', error);
    res.status(500).json({ error: 'Erro ao assinar prontuário' });
  }
});

// Obter versões do prontuário
router.get('/:id/versions', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    // Verificar se o usuário tem acesso ao prontuário
    const record = await prisma.medical_records.findFirst({
      where: {
        id: parseInt(id),
        OR: [
          { patient_id: userId },
          { doctor_id: userId }
        ]
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Prontuário não encontrado' });
    }

    const versions = await prisma.medical_record_versions.findMany({
      where: { medical_record_id: parseInt(id) },
      include: {
        editor: {
          select: {
            id: true,
            full_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(versions);
  } catch (error: any) {
    console.error('Erro ao obter versões:', error);
    res.status(500).json({ error: 'Erro ao obter versões' });
  }
});

// Prontuários do paciente (para pacientes verem seus próprios prontuários)
router.get('/patient/my-records', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { page = 1, limit = 10 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      prisma.medical_records.findMany({
        where: {
          patient_id: userId,
          status: 'signed' // Pacientes só veem prontuários assinados
        },
        include: {
          doctor: {
            select: {
              id: true,
              full_name: true,
              doctors: {
                select: {
                  specialization: true
                }
              }
            }
          },
          appointments: {
            select: {
              id: true,
              date: true,
              type: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: offset
      }),
      prisma.medical_records.count({
        where: {
          patient_id: userId,
          status: 'signed'
        }
      })
    ]);

    res.json({
      records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('Erro ao listar prontuários do paciente:', error);
    res.status(500).json({ error: 'Erro ao listar prontuários' });
  }
});

export default router;