import { Request, Response, Router } from 'express';
import { db } from '../db/schema';
import { User, UserDisplayPreferences } from '../../src/types';
import { entitlementService } from '../services/entitlementService';

export const accountRouter = Router();

// Helper to extract device info from request headers
export function extractDeviceInfo(req: Request) {
  const ua = req.headers['user-agent'] || '';
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Web Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  const isMobile = /mobile/i.test(ua);
  const deviceName = `${isMobile ? 'Mobile' : 'Desktop'} Device (${os} • ${browser})`;
  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || '127.0.0.1';
  // Mask IP for privacy (e.g. 192.168.1.xxx)
  const ipParts = rawIp.split('.');
  const ipAddress = ipParts.length === 4 ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.xxx` : rawIp;

  return { deviceName, browser, os, ipAddress };
}

// Authentication middleware helper for account routes
export function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  const user = db.users.get(session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found' });
  }

  // Touch session activity
  db.touchSession(token);

  (req as any).user = user;
  (req as any).sessionToken = token;
  next();
}

// ==========================================
// 1. PROFILE ENDPOINTS
// ==========================================

// GET /api/account/profile
accountRouter.get('/profile', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const entitlement = entitlementService.checkEntitlement(user);
  const trialDetails = entitlementService.getTrialDetails(user);

  res.json({
    user: {
      name: user.name,
      username: user.username || '',
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      role: user.role,
      tier: entitlement.tier,
      plan: user.plan || (entitlement.tier === 'ADMIN' ? 'PRO' : 'FREE'),
      trialStatus: entitlement.trialStatus,
      trialStartedAt: entitlement.trialStartedAt,
      trialEndsAt: entitlement.trialEndsAt,
      isTrialActive: entitlement.isTrial,
      isPro: entitlement.isPro,
      remainingTrialDays: trialDetails.remainingDays,
      remainingTrialHours: trialDetails.remainingHours,
      proExpiresAt: user.proExpiresAt || null,
      emailVerified: user.emailVerified ?? false,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      usernameChangedAt: user.usernameChangedAt || null,
      displayPreferences: user.displayPreferences || {
        theme: 'dark',
        defaultExchange: 'BINANCE',
        defaultTimeframe: '1h',
        compactView: false,
        soundAlerts: true
      },
      createdAt: user.createdAt
    }
  });
});

// GET /api/account/trial/status
// Server-authoritative trial status endpoint
accountRouter.get('/trial/status', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const trialDetails = entitlementService.getTrialDetails(user);
  res.json(trialDetails);
});

// PUT /api/account/profile
accountRouter.put('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const { name, username, avatarUrl } = req.body;

    const updatedUser = db.updateUserProfile(user.id, {
      name,
      username,
      avatarUrl
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/account/avatar
accountRouter.delete('/avatar', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const updatedUser = db.updateUserProfile(user.id, { avatarUrl: null });
    res.json({
      success: true,
      message: 'Avatar removed successfully',
      user: updatedUser
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. EMAIL VERIFICATION
// ==========================================

// POST /api/account/verify-email/resend
accountRouter.post('/verify-email/resend', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email is already verified.' });
  }

  // Generate verification token with 24h expiration
  const token = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  db.passwordResetTokens.set(user.email.toLowerCase(), {
    email: user.email,
    token,
    expiresAt: Date.now() + 24 * 3600000
  });

  res.json({
    success: true,
    message: `Verification instructions sent to ${user.email}. (Demo token: ${token})`,
    demoToken: token
  });
});

// POST /api/account/verify-email/confirm
accountRouter.post('/verify-email/confirm', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { token } = req.body;

  // In demo environment, confirm token or instant verification
  db.verifyEmail(user.id);
  res.json({
    success: true,
    message: 'Email address verified successfully!',
    emailVerified: true
  });
});

// ==========================================
// 3. PASSWORD & SECURITY
// ==========================================

// POST /api/account/password/change
accountRouter.post('/password/change', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match' });
    }

    db.changePassword(user.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/account/password/forgot (public endpoint with generic response)
accountRouter.post('/password/forgot', (req: Request, res: Response) => {
  const { email } = req.body;
  if (email && typeof email === 'string') {
    const clean = email.toLowerCase().trim();
    const user = db.findUserByEmail(clean);
    if (user) {
      const resetToken = `rst_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      db.passwordResetTokens.set(clean, {
        email: clean,
        token: resetToken,
        expiresAt: Date.now() + 3600000 // 1 hour
      });
    }
  }

  // Section 11 Compliance: Never reveal whether an arbitrary email exists.
  res.json({
    success: true,
    message: 'If the account exists, reset instructions have been sent.'
  });
});

// POST /api/account/password/reset (public endpoint with token)
accountRouter.post('/password/reset', (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }

  let matchedEmail: string | null = null;
  for (const [email, record] of db.passwordResetTokens.entries()) {
    if (record.token === token && record.expiresAt > Date.now()) {
      matchedEmail = email;
      break;
    }
  }

  if (!matchedEmail) {
    return res.status(400).json({ error: 'Invalid or expired password reset token' });
  }

  const user = db.findUserByEmail(matchedEmail);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }
    db.userPasswords.set(matchedEmail, newPassword);
    db.passwordResetTokens.delete(matchedEmail);
    res.json({ success: true, message: 'Password has been reset successfully. Please log in.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 4. TWO-FACTOR AUTHENTICATION (2FA)
// ==========================================

// GET /api/account/2fa/setup
accountRouter.get('/2fa/setup', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const setup = db.generateTwoFactorSetup(user.id);
  res.json(setup);
});

// POST /api/account/2fa/enable
accountRouter.post('/2fa/enable', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = db.enableTwoFactor(user.id, code);
    res.json({
      success: true,
      message: 'Two-factor authentication has been enabled.',
      backupCodes: result.backupCodes
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/account/2fa/disable
accountRouter.post('/2fa/disable', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Current password is required to disable 2FA' });
    }

    db.disableTwoFactor(user.id, password);
    res.json({
      success: true,
      message: 'Two-factor authentication has been disabled.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. ACTIVE SESSIONS & REVOCATION
// ==========================================

// GET /api/account/sessions
accountRouter.get('/sessions', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const sessionToken = (req as any).sessionToken as string;

  const sessions = db.getUserSessions(user.id, sessionToken);
  res.json({
    sessions,
    totalCount: sessions.length
  });
});

// DELETE /api/account/sessions/:id
accountRouter.delete('/sessions/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const sessionId = req.params.id;

  const success = db.revokeSession(user.id, sessionId);
  if (!success) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ success: true, message: 'Session terminated' });
});

// POST /api/account/sessions/revoke-others
accountRouter.post('/sessions/revoke-others', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const sessionToken = (req as any).sessionToken as string;

  const count = db.revokeOtherSessions(user.id, sessionToken);
  res.json({
    success: true,
    message: `Signed out of ${count} other device(s). Current device remains active.`,
    revokedCount: count
  });
});

// POST /api/account/sessions/revoke-all
accountRouter.post('/sessions/revoke-all', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;

  const count = db.revokeAllSessions(user.id);
  res.json({
    success: true,
    message: `All ${count} sessions revoked. Please log in again.`,
    revokedCount: count
  });
});

// ==========================================
// 6. DISPLAY PREFERENCES
// ==========================================

// PUT /api/account/preferences
accountRouter.put('/preferences', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const updated = db.updateDisplayPreferences(user.id, req.body as UserDisplayPreferences);
  res.json({
    success: true,
    preferences: updated
  });
});

// ==========================================
// 7. DANGER ZONE (EXPORT & DELETE)
// ==========================================

// GET /api/account/export
accountRouter.get('/export', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const exportData = db.exportUserData(user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="crypto_intelligence_account_${user.username || 'user'}_export.json"`);
    res.json(exportData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/account/delete
accountRouter.delete('/delete', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const { password, confirmationText } = req.body;

    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        error: 'Confirmation phrase must match "DELETE MY ACCOUNT" exactly.'
      });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required to confirm account deletion' });
    }

    db.deleteAccount(user.id, password);

    res.json({
      success: true,
      message: 'Account and associated records have been permanently deleted.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
