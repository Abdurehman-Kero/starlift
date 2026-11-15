import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { loginAdmin, generateTokens, verifyRefreshToken } from '../services/auth.service';
import { prisma } from '../database/client';

const router = Router();

router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };
    const admin = await loginAdmin(email, password);

    if (!admin) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(admin.email, admin.role);
    res.json({ success: true, data: { ...tokens, role: admin.role, name: admin.name } });
  }
);

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ success: false, message: 'Refresh token required' });
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    return;
  }

  const tokens = generateTokens(payload.email, payload.role);
  res.json({ success: true, data: tokens });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const admin = await prisma.adminUser.findUnique({
    where: { email: req.admin!.email },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (!admin) {
    res.status(404).json({ success: false, message: 'Admin not found' });
    return;
  }

  res.json({ success: true, data: admin });
});

export default router;
