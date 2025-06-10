import { Router } from 'express';

const router = Router();

// Rota placeholder para documentos legais
router.get('/', (req, res) => {
  res.json({ message: 'Legal documents routes' });
});

export default router;