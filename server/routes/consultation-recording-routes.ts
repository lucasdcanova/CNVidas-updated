import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';
import { uploadToS3 } from '../utils/s3-upload';

const router = express.Router();
const prisma = new PrismaClient();

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Configurar multer para upload temporário
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'temp-uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `recording-${uniqueSuffix}.webm`);
    }
  }),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de áudio inválido'));
    }
  }
});

// Upload de gravação
router.post('/upload', isAuthenticated, upload.single('audio'), async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.session.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }

    if (!appointmentId) {
      return res.status(400).json({ success: false, error: 'ID da consulta não fornecido' });
    }

    // Verificar se o usuário é médico e tem acesso à consulta
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { doctors: true }
    });

    if (!user || user.role !== 'doctor') {
      await fs.unlink(file.path); // Limpar arquivo temporário
      return res.status(403).json({ success: false, error: 'Apenas médicos podem gravar consultas' });
    }

    // Verificar se a consulta existe e pertence ao médico
    const appointment = await prisma.appointments.findFirst({
      where: {
        id: parseInt(appointmentId),
        doctor_id: user.doctors[0]?.id
      }
    });

    if (!appointment) {
      await fs.unlink(file.path);
      return res.status(404).json({ success: false, error: 'Consulta não encontrada' });
    }

    // Verificar se já existe gravação para esta consulta
    const existingRecording = await prisma.consultation_recordings.findUnique({
      where: { appointment_id: appointment.id }
    });

    if (existingRecording) {
      await fs.unlink(file.path);
      return res.status(400).json({ success: false, error: 'Já existe uma gravação para esta consulta' });
    }

    // Upload para S3 (ou outro storage)
    let audioUrl: string;
    try {
      audioUrl = await uploadToS3(file.path, `recordings/${appointmentId}/${file.filename}`);
    } catch (error) {
      console.error('Erro no upload S3:', error);
      // Se não tiver S3 configurado, salvar localmente
      const localDir = path.join(process.cwd(), 'uploads', 'recordings', appointmentId.toString());
      await fs.mkdir(localDir, { recursive: true });
      const localPath = path.join(localDir, file.filename);
      await fs.rename(file.path, localPath);
      audioUrl = `/uploads/recordings/${appointmentId}/${file.filename}`;
    }

    // Criar registro no banco
    const recording = await prisma.consultation_recordings.create({
      data: {
        appointment_id: appointment.id,
        audio_url: audioUrl,
        transcription_status: 'pending',
        processing_started_at: new Date()
      }
    });

    // Limpar arquivo temporário se ainda existir
    try {
      await fs.unlink(file.path);
    } catch (error) {
      // Ignorar se já foi movido
    }

    // Iniciar processamento assíncrono
    processRecording(recording.id).catch(error => {
      console.error('Erro no processamento assíncrono:', error);
    });

    res.json({
      success: true,
      recordingId: recording.id,
      message: 'Gravação enviada para processamento'
    });

  } catch (error: any) {
    console.error('Erro no upload:', error);
    
    // Limpar arquivo temporário em caso de erro
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        // Ignorar
      }
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao processar gravação'
    });
  }
});

// Função assíncrona para processar a gravação
async function processRecording(recordingId: number) {
  try {
    const recording = await prisma.consultation_recordings.findUnique({
      where: { id: recordingId },
      include: {
        appointments: {
          include: {
            users: true,
            doctors: {
              include: {
                users: true
              }
            }
          }
        }
      }
    });

    if (!recording || !recording.audio_url) {
      throw new Error('Gravação não encontrada');
    }

    // Baixar áudio se estiver em URL externa
    let audioPath = recording.audio_url;
    if (audioPath.startsWith('http')) {
      // TODO: Implementar download de URL externa
      throw new Error('Download de URL externa não implementado');
    } else {
      // Arquivo local
      audioPath = path.join(process.cwd(), audioPath);
    }

    // Transcrever com Whisper
    console.log('Iniciando transcrição com Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: await fs.readFile(audioPath),
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text'
    });

    // Atualizar transcrição no banco
    await prisma.consultation_recordings.update({
      where: { id: recordingId },
      data: {
        transcription: transcription,
        transcription_status: 'transcribed'
      }
    });

    // Gerar prontuário com GPT-4
    console.log('Gerando prontuário com IA...');
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Você é um assistente médico especializado em criar prontuários médicos estruturados.
          
          Analise a transcrição da consulta e crie um prontuário no formato SOAP (Subjetivo, Objetivo, Avaliação, Plano).
          
          Estrutura do prontuário:
          
          1. IDENTIFICAÇÃO
          - Data e hora da consulta
          - Médico responsável
          - Paciente
          
          2. SUBJETIVO (S)
          - Queixa principal
          - História da doença atual
          - Sintomas relatados
          
          3. OBJETIVO (O)
          - Exame físico mencionado
          - Sinais vitais (se mencionados)
          - Observações clínicas
          
          4. AVALIAÇÃO (A)
          - Hipóteses diagnósticas
          - Diagnóstico provável
          - CID-10 sugerido (se aplicável)
          
          5. PLANO (P)
          - Conduta terapêutica
          - Medicações prescritas
          - Exames solicitados
          - Orientações
          - Retorno
          
          Seja conciso, objetivo e use terminologia médica apropriada.
          Destaque informações importantes como alergias, contraindicações ou alertas.`
        },
        {
          role: 'user',
          content: `Por favor, crie um prontuário médico estruturado baseado nesta transcrição de consulta:
          
          Médico: Dr. ${recording.appointments?.doctors?.users?.full_name}
          Paciente: ${recording.appointments?.users?.full_name}
          
          Transcrição:
          ${transcription}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const aiGeneratedNotes = aiResponse.choices[0].message.content;

    // Atualizar com prontuário gerado
    await prisma.consultation_recordings.update({
      where: { id: recordingId },
      data: {
        ai_generated_notes: aiGeneratedNotes,
        transcription_status: 'completed',
        processing_completed_at: new Date()
      }
    });

    // Criar prontuário médico em rascunho
    const medicalRecord = await prisma.medical_records.create({
      data: {
        patient_id: recording.appointments!.user_id,
        doctor_id: recording.appointments!.doctors!.user_id,
        appointment_id: recording.appointments!.id,
        recording_id: recording.id,
        content: {
          type: 'SOAP',
          data: aiGeneratedNotes,
          transcription: transcription
        },
        status: 'draft',
        ai_generated: true
      }
    });

    console.log(`Processamento concluído para gravação ${recordingId}`);

  } catch (error: any) {
    console.error('Erro no processamento:', error);
    
    // Atualizar status de erro
    await prisma.consultation_recordings.update({
      where: { id: recordingId },
      data: {
        transcription_status: 'error',
        processing_error: error.message,
        processing_completed_at: new Date()
      }
    });
  }
}

// Obter status de processamento
router.get('/status/:recordingId', isAuthenticated, async (req, res) => {
  try {
    const { recordingId } = req.params;
    const userId = req.session.userId;

    // Verificar se o usuário tem acesso
    const recording = await prisma.consultation_recordings.findFirst({
      where: {
        id: parseInt(recordingId),
        appointments: {
          OR: [
            { user_id: userId },
            { doctors: { user_id: userId } }
          ]
        }
      },
      include: {
        medical_records: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });

    if (!recording) {
      return res.status(404).json({ success: false, error: 'Gravação não encontrada' });
    }

    res.json({
      success: true,
      recording: {
        id: recording.id,
        status: recording.transcription_status,
        hasTranscription: !!recording.transcription,
        hasAiNotes: !!recording.ai_generated_notes,
        medicalRecordId: recording.medical_records[0]?.id,
        error: recording.processing_error,
        createdAt: recording.created_at,
        completedAt: recording.processing_completed_at
      }
    });

  } catch (error: any) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status da gravação'
    });
  }
});

// Obter transcrição
router.get('/transcription/:recordingId', isAuthenticated, async (req, res) => {
  try {
    const { recordingId } = req.params;
    const userId = req.session.userId;

    const recording = await prisma.consultation_recordings.findFirst({
      where: {
        id: parseInt(recordingId),
        appointments: {
          OR: [
            { user_id: userId },
            { doctors: { user_id: userId } }
          ]
        }
      }
    });

    if (!recording) {
      return res.status(404).json({ success: false, error: 'Gravação não encontrada' });
    }

    if (!recording.transcription) {
      return res.status(404).json({ success: false, error: 'Transcrição ainda não disponível' });
    }

    res.json({
      success: true,
      transcription: recording.transcription,
      aiNotes: recording.ai_generated_notes
    });

  } catch (error: any) {
    console.error('Erro ao obter transcrição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter transcrição'
    });
  }
});

export default router;