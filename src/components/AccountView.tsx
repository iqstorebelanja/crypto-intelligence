import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User as UserIcon,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Mail,
  Smartphone,
  Monitor,
  Globe,
  Bell,
  Sparkles,
  Check,
  AlertTriangle,
  Trash2,
  Download,
  LogOut,
  RefreshCw,
  Upload,
  Camera,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  ExternalLink,
  Settings,
  Zap,
  Volume2,
  Sliders,
  ChevronRight,
  X,
  CreditCard,
  Bot
} from 'lucide-react';
import { User, UserDisplayPreferences, UserSessionView } from '../types';
import { useTheme } from '../utils/theme';
import { soundAlert } from '../utils/audioAlert';

export type AccountTab =
  | 'profile'
  | 'security'
  | 'sessions'
  | 'notifications'
  | 'preferences'
  | 'subscription'
  | 'danger';

interface AccountViewProps {
  user: User | null;
  token: string | null;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  initialTab?: AccountTab;
  onNavigateToPricing?: () => void;
  onOpenUpgradeModal?: (context?: string) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  token,
  onUpdateUser,
  onLogout,
  onOpenAuth,
  initialTab = 'profile',
  onNavigateToPricing,
  onOpenUpgradeModal
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // Active section tab
  const [activeTab, setActiveTab] = useState<AccountTab>(() => {
    if (location.pathname.includes('/sessions')) return 'sessions';
    return initialTab;
  });

  // Sync tab with URL if needed
  useEffect(() => {
    if (location.pathname.includes('/sessions')) {
      setActiveTab('sessions');
    }
  }, [location.pathname]);

  // General Notification / Banner feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // ------------------------------------------
  // 1. PROFILE STATE
  // ------------------------------------------
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [profileSaving, setProfileSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync when user prop changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setAvatarUrl(user.avatarUrl || null);
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  // Avatar file upload handler
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      showFeedback('error', 'Invalid file type. Only PNG, JPEG, WebP, and SVG images are permitted.');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      showFeedback('error', 'File size exceeds 2MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    if (!token) return;
    try {
      setProfileSaving(true);
      const res = await fetch('/api/account/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove avatar');
      setAvatarUrl(null);
      setAvatarPreview(null);
      if (user) onUpdateUser({ ...user, avatarUrl: null });
      showFeedback('success', 'Avatar removed successfully.');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showFeedback('error', 'Network offline — reconnecting... Account mutations are temporarily paused.');
      return;
    }
    if (!token) return;

    try {
      setProfileSaving(true);
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          avatarUrl: avatarUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      onUpdateUser(data.user);
      showFeedback('success', 'Profile updated successfully.');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // ------------------------------------------
  // EMAIL VERIFICATION FLOW
  // ------------------------------------------
  const [resendingEmail, setResendingEmail] = useState(false);
  const [demoVerificationToken, setDemoVerificationToken] = useState<string | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  const handleResendVerification = async () => {
    if (!token) return;
    try {
      setResendingEmail(true);
      const res = await fetch('/api/account/verify-email/resend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification email');
      if (data.demoToken) setDemoVerificationToken(data.demoToken);
      showFeedback('success', data.message || 'Verification email sent!');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!token) return;
    try {
      setConfirmingEmail(true);
      const res = await fetch('/api/account/verify-email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: verificationInput || demoVerificationToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify email');
      if (user) onUpdateUser({ ...user, emailVerified: true });
      setDemoVerificationToken(null);
      setVerificationInput('');
      showFeedback('success', 'Email address confirmed and verified successfully!');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setConfirmingEmail(false);
    }
  };

  // ------------------------------------------
  // 2. SECURITY & PASSWORD CHANGE
  // ------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: 'Empty', color: 'bg-slate-700' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, text: 'Weak', color: 'bg-rose-500' };
    if (score <= 4) return { score: 2, text: 'Medium', color: 'bg-amber-500' };
    return { score: 3, text: 'Strong', color: 'bg-emerald-500' };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      showFeedback('error', 'New password and confirm password do not match.');
      return;
    }

    if (newPassword.length < 8) {
      showFeedback('error', 'Password must be at least 8 characters long.');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch('/api/account/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showFeedback('success', 'Security credentials updated successfully.');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // ------------------------------------------
  // TWO-FACTOR AUTHENTICATION (2FA) FLOW
  // ------------------------------------------
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; qrCodeText: string; backupCodes: string[] } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[] | null>(null);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [isDisable2FAModalOpen, setIsDisable2FAModalOpen] = useState(false);

  const handleStart2FASetup = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/account/2fa/setup', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize 2FA');
      setTwoFactorSetup(data);
      setIs2FAModalOpen(true);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleConfirm2FA = async () => {
    if (!token || !twoFactorCode) return;
    try {
      const res = await fetch('/api/account/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: twoFactorCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid 2FA code');

      if (user) onUpdateUser({ ...user, twoFactorEnabled: true });
      setTwoFactorBackupCodes(data.backupCodes || twoFactorSetup?.backupCodes || []);
      showFeedback('success', 'Two-factor authentication successfully enabled.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDisable2FA = async () => {
    if (!token || !disable2FAPassword) return;
    try {
      const res = await fetch('/api/account/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: disable2FAPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');

      if (user) onUpdateUser({ ...user, twoFactorEnabled: false });
      setIsDisable2FAModalOpen(false);
      setDisable2FAPassword('');
      showFeedback('success', 'Two-factor authentication disabled.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // ------------------------------------------
  // 3. SESSIONS MANAGEMENT
  // ------------------------------------------
  const [sessions, setSessions] = useState<UserSessionView[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  const fetchSessions = async () => {
    if (!token) return;
    try {
      setLoadingSessions(true);
      const res = await fetch('/api/account/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions' && token) {
      fetchSessions();
    }
  }, [activeTab, token]);

  const handleRevokeSingleSession = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/account/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke session');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      showFeedback('success', 'Session terminated.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/account/sessions/revoke-others', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke other sessions');
      setSessions(prev => prev.filter(s => s.isCurrent));
      showFeedback('success', data.message || 'Signed out of other devices.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/account/sessions/revoke-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke sessions');
      setShowRevokeAllConfirm(false);
      showFeedback('info', 'All sessions revoked. Redirecting...');
      setTimeout(() => onLogout(), 1200);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // ------------------------------------------
  // 4. NOTIFICATION PREFERENCES
  // ------------------------------------------
  const [notifChannels, setNotifChannels] = useState({
    inApp: true,
    browserPush: false,
    telegram: false,
    email: true
  });

  const [notifCategories, setNotifCategories] = useState({
    marketAlerts: true,
    signalAlerts: true,
    whaleAlerts: true,
    riskAlerts: true,
    systemNotifications: true,
    communityNotifications: false
  });

  const [savingNotifs, setSavingNotifs] = useState(false);

  const handleSaveNotifications = () => {
    setSavingNotifs(true);
    setTimeout(() => {
      setSavingNotifs(false);
      showFeedback('success', 'Notification preferences saved.');
    }, 400);
  };

  // Request browser push permission helper
  const handleTogglePush = async () => {
    if (!('Notification' in window)) {
      showFeedback('info', 'Browser notifications not supported in this browser.');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotifChannels(prev => ({ ...prev, browserPush: !prev.browserPush }));
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotifChannels(prev => ({ ...prev, browserPush: true }));
        showFeedback('success', 'Browser push notifications enabled.');
      } else {
        showFeedback('error', 'Push permission was denied by browser settings.');
      }
    }
  };

  // ------------------------------------------
  // 5. DISPLAY & THEME PREFERENCES
  // ------------------------------------------
  const [displayPrefs, setDisplayPrefs] = useState<UserDisplayPreferences>(() => {
    return user?.displayPreferences || {
      theme: 'dark',
      defaultExchange: 'BINANCE',
      defaultTimeframe: '1h',
      compactView: false,
      soundAlerts: true
    };
  });

  const [savingPrefs, setSavingPrefs] = useState(false);

  const handleSavePreferences = async () => {
    if (!token) return;
    try {
      setSavingPrefs(true);
      const res = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(displayPrefs)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save preferences');

      if (displayPrefs.theme) setTheme(displayPrefs.theme === 'light' ? 'light' : 'dark');
      if (displayPrefs.defaultExchange) localStorage.setItem('active_exchange', displayPrefs.defaultExchange);
      if (user) onUpdateUser({ ...user, displayPreferences: displayPrefs });

      showFeedback('success', 'Display & workspace preferences updated.');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  // ------------------------------------------
  // 6. DANGER ZONE (EXPORT & DELETE)
  // ------------------------------------------
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleExportData = async () => {
    if (!token) return;
    try {
      setExporting(true);
      const res = await fetch('/api/account/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export analytical data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crypto_intelligence_account_${user?.username || 'user'}_export.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showFeedback('success', 'Account data export downloaded successfully.');
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    if (deleteConfirmationInput !== 'DELETE MY ACCOUNT') {
      showFeedback('error', 'Confirmation phrase must match "DELETE MY ACCOUNT" exactly.');
      return;
    }
    if (!deletePassword) {
      showFeedback('error', 'Password is required to confirm account deletion.');
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          confirmationText: deleteConfirmationInput,
          password: deletePassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');

      setIsDeleteModalOpen(false);
      showFeedback('info', 'Account permanently deleted. Logging out...');
      setTimeout(() => onLogout(), 1200);
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper date formatter
  const formatDate = (ts: number | undefined) => {
    if (!ts) return 'Unknown';
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRelativeTime = (ts: number | undefined) => {
    if (!ts) return 'Recently';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Active just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // If not logged in, show authenticated gateway
  if (!user || !token) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl bg-[#080d16] border border-[#1b273d] shadow-2xl max-w-md mx-auto space-y-5 font-mono">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Authentication Required</h2>
            <p className="text-xs text-slate-400 mt-2 font-sans">
              Sign in to manage your analyst profile, active device sessions, security keys, and display preferences.
            </p>
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
          >
            Authenticate Terminal Session
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const isTrialActive = user.trialStatus === 'ACTIVE' && Boolean(user.trialEndsAt && user.trialEndsAt > Date.now());
  const isTrialExpired = user.trialStatus === 'EXPIRED';
  const isPro = isAdmin || (user.isPro && !isTrialExpired) || isTrialActive;

  let trialRemainingText = '';
  if (isTrialActive && user.trialEndsAt) {
    const diffMs = user.trialEndsAt - Date.now();
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    if (days >= 1) {
      trialRemainingText = `${days} day${days > 1 ? 's' : ''} remaining`;
    } else {
      trialRemainingText = `${Math.max(1, hours)} hour${hours > 1 ? 's' : ''} remaining`;
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 font-mono text-xs text-slate-300">
      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border shadow-2xl flex items-center space-x-3 text-xs font-mono transition-all animate-in slide-in-from-top-4 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          {feedback.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
          <span className="font-medium">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER HERO BANNER */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#0a101d] via-[#0d1527] to-[#080d16] border border-[#1b273d] p-6 sm:p-8 mb-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            {/* AVATAR DISPLAY & QUICK UPLOAD TRIGGER */}
            <div className="relative group">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={user.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-cyan-500/50 shadow-xl shadow-cyan-500/10"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-cyan-900/60 to-slate-900 border-2 border-cyan-500/40 text-cyan-300 flex items-center justify-center text-2xl font-bold tracking-wider shadow-xl shadow-cyan-500/10">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'AN'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-white transition-opacity font-sans"
                title="Change Avatar"
              >
                <Camera className="w-5 h-5 mb-1 text-cyan-400" />
                <span>Change</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>

            {/* IDENTITY DETAILS */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {user.name || 'Quantitative Analyst'}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${
                    isAdmin
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                      : isTrialActive
                      ? 'bg-gradient-to-r from-amber-950 to-cyan-950 text-amber-300 border-amber-500/60'
                      : isPro
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isAdmin
                    ? 'ADMINISTRATOR'
                    : isTrialActive
                    ? 'PRO TRIAL'
                    : isPro
                    ? 'PRO MEMBER'
                    : 'FREE PLAN'}
                </span>
                {isTrialActive && (
                  <span className="text-[11px] text-amber-400/90 font-bold font-mono">
                    {trialRemainingText}
                  </span>
                )}
                {isTrialExpired && (
                  <span className="text-[10px] text-slate-500 font-sans">
                    (Trial Expired)
                  </span>
                )}
                {user.emailVerified ? (
                  <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-sans">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-[10px] text-amber-400 font-sans">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Unverified</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-400">
                <span className="text-cyan-400 font-bold">@{user.username || 'analyst'}</span>
                <span>•</span>
                <span>{user.email}</span>
                <span>•</span>
                <span className="text-[11px] text-slate-500 font-sans">Member since {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('sessions')}
              className="px-3.5 py-2 rounded-xl bg-[#111a2c] hover:bg-[#16233b] border border-[#202f4a] text-slate-300 hover:text-white flex items-center space-x-2 transition-all"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Active Sessions</span>
            </button>
            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/40 text-rose-300 hover:text-rose-100 flex items-center space-x-2 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS (Mobile Scrollable & Desktop Horizontal) */}
      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-[#182338] pb-3 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'profile', label: 'PROFILE', icon: UserIcon },
          { id: 'security', label: 'SECURITY', icon: ShieldCheck },
          { id: 'sessions', label: 'SESSIONS', icon: Monitor },
          { id: 'notifications', label: 'NOTIFICATIONS', icon: Bell },
          { id: 'preferences', label: 'PREFERENCES', icon: Sliders },
          { id: 'subscription', label: 'SUBSCRIPTION', icon: Sparkles },
          { id: 'danger', label: 'DANGER ZONE', icon: AlertTriangle, danger: true }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AccountTab)}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all flex-shrink-0 ${
                isActive
                  ? tab.danger
                    ? 'bg-rose-950/50 text-rose-300 border border-rose-500/50 shadow-md shadow-rose-900/20'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? (tab.danger ? 'text-rose-400' : 'text-cyan-400') : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* TAB 1: PROFILE MANAGEMENT */}
      {/* ==================================================== */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <UserIcon className="w-4 h-4 text-cyan-400" />
                  <span>Public Analyst Profile</span>
                </h3>
                <p className="text-slate-400 font-sans mt-1">
                  Manage how other quantitative traders and community members view your profile.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* DISPLAY NAME */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold uppercase tracking-wider">Display Name</label>
                    <span className="text-[10px] text-slate-500">{name.length}/50</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. John Alpha"
                    className="w-full p-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* USERNAME */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold uppercase tracking-wider">Username Handle</label>
                    <span className="text-[10px] text-slate-500">3-20 chars (letters, numbers, _)</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-cyan-400 font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="johncrypto"
                      className="w-full pl-8 pr-3 py-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  {user.usernameChangedAt && Date.now() - user.usernameChangedAt < 7 * 86400000 && (
                    <div className="mt-1.5 text-[11px] text-amber-400 font-sans flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>Username was modified recently. Cooldown active (can only be updated once per 7 days).</span>
                    </div>
                  )}
                </div>

                {/* EMAIL ADDRESS */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold uppercase tracking-wider">Email Address</label>
                    {user.emailVerified ? (
                      <span className="text-emerald-400 flex items-center space-x-1 font-sans">
                        <CheckCircle className="w-3 h-3" />
                        <span>Verified Account</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendingEmail}
                        className="text-cyan-400 hover:underline font-sans"
                      >
                        {resendingEmail ? 'Sending instructions...' : 'Resend Verification Email'}
                      </button>
                    )}
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full p-3 rounded-xl bg-[#080d16] border border-[#1a2538] text-slate-400 cursor-not-allowed"
                  />
                  <div className="text-[11px] text-slate-500 mt-1 font-sans">
                    Email address is tied to your terminal authentication credentials.
                  </div>
                </div>

                {/* DEMO EMAIL VERIFICATION PROMPT IF NOT VERIFIED */}
                {!user.emailVerified && (
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 space-y-3 font-sans">
                    <div className="flex items-start space-x-2 text-amber-300 font-medium">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span>Your email address is unverified.</span>
                        <div className="text-xs text-amber-400/80 mt-0.5">
                          Verified accounts receive real-time signal dispatch alerts and priority Community forum badges.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Enter verification code"
                        value={verificationInput}
                        onChange={e => setVerificationInput(e.target.value)}
                        className="p-2 rounded-lg bg-[#080d16] border border-amber-600/40 text-xs text-white placeholder-slate-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmVerification}
                        disabled={confirmingEmail}
                        className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs transition-colors"
                      >
                        {confirmingEmail ? 'Confirming...' : 'Verify Now'}
                      </button>
                    </div>
                  </div>
                )}

                {/* AVATAR URL / UPLOAD DETAILS */}
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                    Avatar Image URL (or upload above)
                  </label>
                  <input
                    type="url"
                    value={avatarUrl?.startsWith('data:') ? 'Custom file uploaded' : avatarUrl || ''}
                    disabled={avatarUrl?.startsWith('data:')}
                    onChange={e => {
                      setAvatarUrl(e.target.value);
                      setAvatarPreview(e.target.value);
                    }}
                    placeholder="https://example.com/avatar.png"
                    className="w-full p-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <div className="flex items-center space-x-3 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-cyan-400 hover:underline flex items-center space-x-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload local image</span>
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="text-rose-400 hover:underline flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove avatar</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="py-3 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-600/20 active:scale-95 flex items-center space-x-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* SIDEBAR: ACCOUNT OVERVIEW & METRICS */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-4">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-[#141d2d] pb-2">
                Plan & Capabilities
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Current Tier:</span>
                  <span className="font-bold text-cyan-400 uppercase">
                    {isAdmin ? 'ADMINISTRATOR' : isTrialActive ? 'PRO TRIAL' : isPro ? 'PRO MEMBER' : 'FREE PLAN'}
                  </span>
                </div>
                {isTrialActive && (
                  <div className="flex justify-between items-center bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30">
                    <span className="text-amber-300 font-bold font-mono">Trial Remaining:</span>
                    <span className="font-bold text-amber-300 font-mono">{trialRemainingText}</span>
                  </div>
                )}
                {isTrialExpired && (
                  <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-slate-400 font-mono">Status:</span>
                    <span className="font-bold text-slate-300 font-mono">Trial Expired (Free Plan)</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Role Permission:</span>
                  <span className="font-bold text-white uppercase">{user.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Created Date:</span>
                  <span className="text-slate-300">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">2FA Protection:</span>
                  <span className={user.twoFactorEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {user.twoFactorEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {!isPro && (
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('subscription')}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold uppercase tracking-wider text-[11px] transition-all shadow-lg shadow-amber-600/20"
                  >
                    Upgrade to PRO Analytics
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: SECURITY & TWO-FACTOR AUTH */}
      {/* ==================================================== */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PASSWORD CHANGE FORM */}
          <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>Change Password</span>
              </h3>
              <p className="text-slate-400 font-sans mt-1">
                Protect your quantitative signals and analyst settings with strong cryptographic passwords.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider">New Password</label>
                  <span className={`text-[10px] font-bold ${passwordStrength.color} px-2 py-0.5 rounded text-white`}>
                    {passwordStrength.text}
                  </span>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className="w-full p-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full p-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="text-[11px] text-slate-500 font-sans space-y-1">
                <div>• Must be at least 8 characters in length.</div>
                <div>• Must contain uppercase, lowercase letters and numerical digits.</div>
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-wider shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
              >
                {changingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* TWO-FACTOR AUTHENTICATION & LOGIN SECURITY */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Two-Factor Authentication (2FA)</span>
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      user.twoFactorEnabled
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {user.twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-slate-400 font-sans mt-2">
                  Require a time-based one-time password (TOTP) from an authenticator app (e.g. Google Authenticator) upon login.
                </p>
              </div>

              {user.twoFactorEnabled ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-600/40 flex items-center space-x-3 text-emerald-200">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div className="font-sans">
                      <span className="font-bold">2FA is active and protecting your terminal session.</span>
                      <div className="text-[11px] text-emerald-400/80">
                        Authentication tokens require two-factor verification.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDisable2FAModalOpen(true)}
                    className="py-2.5 px-4 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 text-rose-300 text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Disable Two-Factor Authentication
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#1a2842] text-slate-300 font-sans">
                    Enable two-factor authentication to secure your quantitative radar against unauthorized session access.
                  </div>
                  <button
                    onClick={handleStart2FASetup}
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-bold uppercase tracking-wider text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    Setup Two-Factor Authentication
                  </button>
                </div>
              )}
            </div>

            {/* BRUTE-FORCE PROTECTION & RATE LIMITING STATUS */}
            <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-4">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-[#141d2d] pb-2">
                Terminal Security Hardening
              </h4>
              <div className="space-y-2.5 font-sans text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Failed Login Lockout:</span>
                  <span className="text-emerald-400 font-mono font-bold">5 Attempts (15m Lock)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Session Lifecycle:</span>
                  <span className="text-cyan-400 font-mono font-bold">7-Day Rolling Expiry</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">CSRF & Header Protection:</span>
                  <span className="text-emerald-400 font-mono font-bold">Strict (SameOrigin)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: ACTIVE SESSIONS */}
      {/* ==================================================== */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                <span>Active Device Sessions</span>
              </h3>
              <p className="text-slate-400 font-sans mt-1">
                Review and revoke authorized terminals and browsers logged into your account.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchSessions}
                disabled={loadingSessions}
                className="p-2 rounded-xl bg-[#0e1626] border border-[#1c2a42] text-slate-400 hover:text-white"
                title="Refresh sessions"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <button
                  onClick={handleRevokeOtherSessions}
                  className="px-3.5 py-2 rounded-xl bg-[#111c30] hover:bg-[#182847] border border-cyan-700/40 text-cyan-300 font-bold uppercase tracking-wider text-[11px] transition-all"
                >
                  Sign Out Other Devices
                </button>
              )}
              <button
                onClick={() => setShowRevokeAllConfirm(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 text-rose-300 font-bold uppercase tracking-wider text-[11px] transition-all"
              >
                Sign Out All Sessions
              </button>
            </div>
          </div>

          {loadingSessions ? (
            <div className="p-12 text-center text-slate-500 font-sans">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
              <span>Querying session registry...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    s.isCurrent
                      ? 'bg-gradient-to-r from-[#0d182b] to-[#080d16] border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                      : 'bg-[#080d16] border-[#182338] hover:border-[#223250]'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-3 rounded-xl border ${
                        s.isCurrent
                          ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-400'
                          : 'bg-[#10192a] border-[#1c2a42] text-slate-400'
                      }`}
                    >
                      {s.os.toLowerCase().includes('android') || s.os.toLowerCase().includes('ios') ? (
                        <Smartphone className="w-6 h-6" />
                      ) : (
                        <Monitor className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{s.deviceName}</span>
                        {s.isCurrent && (
                          <span className="px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold">
                            CURRENT DEVICE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-slate-400 text-xs mt-1">
                        <span>{s.browser}</span>
                        <span>•</span>
                        <span>{s.os}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">{s.ipAddress}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-sans">
                        Last active: <span className="text-slate-300 font-medium">{formatRelativeTime(s.lastActiveAt)}</span>
                        {' '}(Created {formatDate(s.createdAt)})
                      </div>
                    </div>
                  </div>

                  <div>
                    {s.isCurrent ? (
                      <button
                        onClick={onLogout}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/40 text-rose-300 text-xs font-bold transition-all"
                      >
                        Sign Out This Device
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevokeSingleSession(s.id)}
                        className="p-2 rounded-xl bg-[#141e30] hover:bg-rose-950/50 border border-[#21304b] hover:border-rose-700/50 text-slate-400 hover:text-rose-300 transition-all"
                        title="Revoke session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: NOTIFICATION PREFERENCES */}
      {/* ==================================================== */}
      {activeTab === 'notifications' && (
        <div className="max-w-4xl space-y-6">
          <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span>Quantitative Alert Routing</span>
              </h3>
              <p className="text-slate-400 font-sans mt-1">
                Configure delivery channels and alert triggers across quantitative engines.
              </p>
            </div>

            {/* DELIVERY CHANNELS */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-[#141d2d] pb-1.5">
                Delivery Channels
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#0c1424] border border-[#18263f] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">In-App Chimes & Banners</div>
                    <div className="text-[11px] text-slate-400 font-sans">Audio and visual notifications in-browser</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifChannels.inApp}
                    onChange={e => setNotifChannels(prev => ({ ...prev, inApp: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#0c1424] border border-[#18263f] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Browser Push</div>
                    <div className="text-[11px] text-slate-400 font-sans">System notifications when app is in background</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifChannels.browserPush}
                    onChange={handleTogglePush}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#0c1424] border border-[#18263f] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Telegram Alerts</div>
                    <div className="text-[11px] text-slate-400 font-sans">Direct bot messages via Telegram Bot</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifChannels.telegram}
                    onChange={e => setNotifChannels(prev => ({ ...prev, telegram: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#0c1424] border border-[#18263f] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Email Digest</div>
                    <div className="text-[11px] text-slate-400 font-sans">Summary briefings delivered to {user.email}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifChannels.email}
                    onChange={e => setNotifChannels(prev => ({ ...prev, email: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* ALERT CATEGORIES */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs border-b border-[#141d2d] pb-1.5">
                Alert Engine Categories
              </h4>
              <div className="space-y-2">
                {[
                  { id: 'marketAlerts', title: 'Market Volatility & Price Action', desc: 'Threshold alerts triggered on watchlist assets' },
                  { id: 'signalAlerts', title: 'Signal Engine Breakouts', desc: 'Authoritative Bullish and Bearish trend confirmations' },
                  { id: 'whaleAlerts', title: 'Whale Radar Intelligence', desc: 'Large on-chain / spot transactions exceeding $1,000,000' },
                  { id: 'riskAlerts', title: 'Crash Risk & Downside Alarms', desc: 'Abnormal volatility spikes and cascading liquidation warnings' },
                  { id: 'systemNotifications', title: 'System & Maintenance Alerts', desc: 'Infrastructure updates and exchange connector health' },
                  { id: 'communityNotifications', title: 'Community Mentions & Replies', desc: 'Discussions on threads where you participate' }
                ].map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#0d1422] border border-[#19263c] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-400 font-sans">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(notifCategories as any)[item.id]}
                      onChange={e =>
                        setNotifCategories(prev => ({ ...prev, [item.id]: e.target.checked }))
                      }
                      className="w-4 h-4 accent-cyan-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveNotifications}
              disabled={savingNotifs}
              className="py-3 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-600/20 active:scale-95"
            >
              {savingNotifs ? 'Saving...' : 'Save Notification Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: DISPLAY & WORKSPACE PREFERENCES */}
      {/* ==================================================== */}
      {activeTab === 'preferences' && (
        <div className="max-w-4xl space-y-6">
          <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Workspace & Display Preferences</span>
              </h3>
              <p className="text-slate-400 font-sans mt-1">
                Customize your terminal visual styling, default exchange connector, and timeframe.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* THEME SELECTOR */}
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-2">
                  Color Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dark', label: 'Dark Void' },
                    { id: 'light', label: 'Daylight' },
                    { id: 'terminal', label: 'Cyberpunk' }
                  ].map(th => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        setDisplayPrefs(p => ({ ...p, theme: th.id as any }));
                        setTheme(th.id === 'light' ? 'light' : 'dark');
                      }}
                      className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                        displayPrefs.theme === th.id
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-[#0c1424] border-[#18263f] text-slate-400 hover:text-white'
                      }`}
                    >
                      {th.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* DEFAULT EXCHANGE */}
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-2">
                  Default Exchange
                </label>
                <select
                  value={displayPrefs.defaultExchange}
                  onChange={e => setDisplayPrefs(p => ({ ...p, defaultExchange: e.target.value }))}
                  className="w-full p-3 rounded-xl bg-[#0d1422] border border-[#1f2d47] text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="BINANCE">Binance Global</option>
                  <option value="BYBIT">Bybit Unified</option>
                  <option value="OKX">OKX Order Book</option>
                  <option value="PIONEX">Pionex</option>
                  <option value="COINBASE">Coinbase Advanced</option>
                  <option value="KRAKEN">Kraken</option>
                </select>
              </div>

              {/* DEFAULT TIMEFRAME */}
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-2">
                  Default Chart Timeframe
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['15m', '1h', '4h', '1d'].map(tf => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setDisplayPrefs(p => ({ ...p, defaultTimeframe: tf }))}
                      className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                        displayPrefs.defaultTimeframe === tf
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-[#0c1424] border-[#18263f] text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* AUDIO & COMPACT VIEW */}
              <div className="space-y-3">
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                  Audio & Density
                </label>
                <div className="p-3 rounded-xl bg-[#0c1424] border border-[#18263f] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white">Audio Alerts</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => soundAlert.testSound('chime')}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      Test Chime
                    </button>
                    <input
                      type="checkbox"
                      checked={displayPrefs.soundAlerts}
                      onChange={e => setDisplayPrefs(p => ({ ...p, soundAlerts: e.target.checked }))}
                      className="w-4 h-4 accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0c1424] border border-[#18263f] flex items-center justify-between">
                  <div className="font-bold text-white">Compact Table Density</div>
                  <input
                    type="checkbox"
                    checked={displayPrefs.compactView}
                    onChange={e => setDisplayPrefs(p => ({ ...p, compactView: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePreferences}
              disabled={savingPrefs}
              className="py-3 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-600/20 active:scale-95"
            >
              {savingPrefs ? 'Saving Preferences...' : 'Save Workspace Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 6: SUBSCRIPTION / ENTITLEMENT */}
      {/* ==================================================== */}
      {activeTab === 'subscription' && (
        <div className="max-w-4xl space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#0c1626] to-[#080d16] border border-[#1e2f4c] shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#182338] pb-6 mb-6">
              <div>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest font-mono">
                  Current Entitlement
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {isAdmin
                    ? 'ADMINISTRATOR PASS'
                    : isTrialActive
                    ? 'PRO TRIAL'
                    : isPro
                    ? 'PRO ANALYST TIER'
                    : 'FREE PLAN'}
                </h3>
                <div className="text-xs text-slate-400 mt-1 font-sans">
                  {isTrialActive ? (
                    <span className="text-amber-300 font-bold font-mono flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span>PRO TRIAL • {trialRemainingText}</span>
                    </span>
                  ) : isTrialExpired ? (
                    <span className="text-slate-400">
                      Free Plan • 7-Day Trial Completed (Standard market analytics active)
                    </span>
                  ) : isPro ? (
                    <span className="text-emerald-400 font-bold">
                      PRO Active • Unrestricted Quantitative Intelligence
                    </span>
                  ) : (
                    <span>Status: <strong className="text-emerald-400">Active</strong> • Foundational market intelligence</span>
                  )}
                </div>
              </div>

              {/* Action Buttons & Status Badge */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {isTrialActive ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-bold text-center">
                      <div className="flex items-center justify-center space-x-1 font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>PRO TRIAL</span>
                      </div>
                      <div className="text-[11px] text-amber-300/90 font-mono mt-0.5">{trialRemainingText}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToPricing) onNavigateToPricing();
                        else navigate('/pricing');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center space-x-1.5"
                    >
                      <span>View PRO Plans</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : isPro ? (
                  <div className="flex items-center space-x-2">
                    <span className="px-3.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>PRO Active</span>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenUpgradeModal) onOpenUpgradeModal('Account Overview');
                      else if (onNavigateToPricing) onNavigateToPricing();
                      else navigate('/pricing');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upgrade to PRO</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Section 17 Detailed Plan & Trial Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 font-mono text-xs">
              <div className="p-3.5 rounded-2xl bg-[#09111e] border border-[#162238] space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Current Plan</span>
                <div className="font-bold text-white text-sm">
                  {isAdmin ? 'ADMIN PASS' : isTrialActive ? 'PRO TRIAL' : isPro ? 'PRO' : 'FREE'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#09111e] border border-[#162238] space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Trial Status</span>
                <div className={`font-bold text-sm ${isTrialActive ? 'text-amber-400' : isTrialExpired ? 'text-slate-400' : 'text-slate-300'}`}>
                  {user.trialStatus || (isTrialActive ? 'ACTIVE' : isTrialExpired ? 'EXPIRED' : 'NONE')}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#09111e] border border-[#162238] space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Trial End Date</span>
                <div className="font-bold text-slate-200 text-xs">
                  {user.trialEndsAt
                    ? new Date(user.trialEndsAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : isTrialExpired
                    ? 'Completed'
                    : 'N/A'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#09111e] border border-[#162238] space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Subscription Status</span>
                <div className="font-bold text-sm">
                  {isPro ? (
                    <span className="text-emerald-400">Active</span>
                  ) : isTrialActive ? (
                    <span className="text-amber-400">Trial Active</span>
                  ) : isTrialExpired ? (
                    <span className="text-slate-400">Expired (Free Tier)</span>
                  ) : (
                    <span className="text-slate-300">Free Tier</span>
                  )}
                </div>
              </div>
            </div>

            {/* CAPABILITIES COMPARISON MATRIX */}
            <div className="space-y-4 font-sans text-xs">
              <h4 className="font-mono font-bold text-white uppercase tracking-wider text-xs">
                Platform Free vs. PRO Entitlement Matrix
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    title: 'Signal Intelligence & Confluence',
                    free: 'Full signals for BTC & ETH; others public market data',
                    pro: 'Full signals & MTF Confluence for all 100+ assets'
                  },
                  {
                    title: 'Bull & Downside Risk Scores',
                    free: 'Full breakdown for BTC & ETH; others locked',
                    pro: 'Institutional quantitative scores on all pairs'
                  },
                  {
                    title: 'Whale Intelligence & Radar',
                    free: 'BTC & ETH on-chain flows',
                    pro: 'Sub-second multi-chain whale radar'
                  },
                  {
                    title: 'Order Flow & CVD Divergence',
                    free: 'Basic volume indicators',
                    pro: 'Institutional aggressive flow & CVD models'
                  },
                  {
                    title: 'AI Trader Intelligence',
                    free: '5 queries/day (or via rewarded ads)',
                    pro: 'Unlimited 24/7 AI quant queries'
                  },
                  {
                    title: 'Community Forum Access',
                    free: 'Locked (PRO required)',
                    pro: 'Full posting & alpha thread access'
                  },
                  {
                    title: 'Custom Watchlist Tracking',
                    free: 'Up to 5 assets',
                    pro: 'Unlimited assets & multi-exchange tracking'
                  },
                  {
                    title: 'Quantitative Price & Score Alerts',
                    free: 'Up to 3 active alerts',
                    pro: 'Unlimited multi-exchange automated alerts'
                  }
                ].map((row, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#09111e] border border-[#162238] space-y-1">
                    <div className="font-bold text-white text-xs">{row.title}</div>
                    <div className="flex flex-col space-y-0.5 text-[11px]">
                      <span className="text-slate-400">FREE: {row.free}</span>
                      <span className="text-cyan-400 font-bold">PRO: {row.pro}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#182338] text-[11px] text-slate-500 font-mono">
              Note: Analytical intelligence platform. Server-authoritative entitlement enforcement. No trading execution or financial custody.
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 7: DANGER ZONE (EXPORT & DELETE) */}
      {/* ==================================================== */}
      {activeTab === 'danger' && (
        <div className="max-w-4xl space-y-6">
          {/* EXPORT DATA */}
          <div className="p-6 rounded-2xl bg-[#080d16] border border-[#182338] shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Export Analytical Profile & History</span>
              </h3>
              <p className="text-slate-400 font-sans mt-1">
                Download a complete, machine-readable JSON archive of your personal watchlist, alerts configuration, active sessions, and display preferences.
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="py-3 px-5 rounded-xl bg-[#111c30] hover:bg-[#182845] border border-cyan-500/40 text-cyan-300 font-bold uppercase tracking-wider text-xs transition-all flex items-center space-x-2 shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Generating JSON Export...' : 'Download Account Data (JSON)'}</span>
            </button>
          </div>

          {/* PERMANENT ACCOUNT DELETION */}
          <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-800/50 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Delete Account & Terminate Credentials</span>
              </h3>
              <p className="text-slate-300 font-sans mt-1 text-xs">
                Permanently erase your analyst handle (@{user.username || 'user'}), stored watchlists, alert triggers, active sessions, and profile data. This operation is immediate and irreversible.
              </p>
            </div>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider text-xs transition-all shadow-lg shadow-rose-600/20 active:scale-95 flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Permanently Delete My Account</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: 2FA SETUP FLOW */}
      {/* ==================================================== */}
      {is2FAModalOpen && twoFactorSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0c121e] border border-[#22314d] rounded-2xl shadow-2xl p-6 space-y-5 font-mono">
            <div className="flex items-center justify-between border-b border-[#1a263d] pb-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-5 h-5" />
                <span>Configure Two-Factor Authenticator</span>
              </div>
              <button
                onClick={() => {
                  setIs2FAModalOpen(false);
                  setTwoFactorSetup(null);
                  setTwoFactorBackupCodes(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {twoFactorBackupCodes ? (
              <div className="space-y-4 font-sans text-xs">
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200">
                  <div className="font-bold font-mono">Two-Factor Authentication is now enabled!</div>
                  <div className="mt-1 text-[11px]">
                    Store these emergency recovery backup codes in a secure offline location. Each can be used once to access your account if your device is lost.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#080d16] border border-[#1f2d47] font-mono grid grid-cols-2 gap-2 text-center text-cyan-300">
                  {twoFactorBackupCodes.map((c, i) => (
                    <div key={i} className="p-1.5 bg-[#0e1626] rounded border border-[#19273f]">
                      {c}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(twoFactorBackupCodes.join('\n'));
                    setCopiedBackup(true);
                    setTimeout(() => setCopiedBackup(false), 2000);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#141e30] border border-cyan-700/50 text-cyan-300 font-bold uppercase tracking-wider text-xs flex items-center justify-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedBackup ? 'Copied to Clipboard!' : 'Copy Recovery Codes'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIs2FAModalOpen(false);
                    setTwoFactorSetup(null);
                    setTwoFactorBackupCodes(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-bold uppercase tracking-wider text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4 font-sans text-xs">
                <div>
                  <div className="text-slate-300 font-medium">1. Scan QR code or enter secret key:</div>
                  <div className="p-3 mt-1.5 rounded-xl bg-[#080d16] border border-[#1f2d47] font-mono text-center select-all text-cyan-400 font-bold tracking-wider">
                    {twoFactorSetup.secret}
                  </div>
                </div>

                <div>
                  <div className="text-slate-300 font-medium">2. Enter 6-digit verification code from app:</div>
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full mt-1.5 p-3 rounded-xl bg-[#080d16] border border-[#1f2d47] text-white text-center font-mono text-lg font-bold tracking-widest focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConfirm2FA}
                  disabled={twoFactorCode.length !== 6}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-bold uppercase tracking-wider text-xs transition-colors shadow-lg shadow-emerald-600/20"
                >
                  Verify & Activate 2FA
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: DISABLE 2FA */}
      {/* ==================================================== */}
      {isDisable2FAModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0c121e] border border-[#22314d] rounded-2xl shadow-2xl p-6 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-[#1a263d] pb-3">
              <span className="text-rose-400 font-bold">Disable Two-Factor Authentication</span>
              <button onClick={() => setIsDisable2FAModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-400 font-sans text-xs">
              Enter your current account password to confirm removal of 2FA protection.
            </p>
            <input
              type="password"
              placeholder="Current password"
              value={disable2FAPassword}
              onChange={e => setDisable2FAPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#080d16] border border-[#1f2d47] text-white focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDisable2FAModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-[#141e30] text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisable2FA}
                disabled={!disable2FAPassword}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CONFIRM REVOKE ALL SESSIONS */}
      {/* ==================================================== */}
      {showRevokeAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0c121e] border border-rose-800/50 rounded-2xl shadow-2xl p-6 space-y-4 font-mono">
            <div className="flex items-center space-x-2 text-rose-400 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Sign Out of All Sessions</span>
            </div>
            <p className="text-slate-300 font-sans text-xs">
              This will revoke all authorized sessions across all browsers, mobile devices, and terminals, including your current device. You will need to log in again.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRevokeAllConfirm(false)}
                className="w-1/2 py-2.5 rounded-xl bg-[#141e30] text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeAllSessions}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Confirm Sign Out All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: DELETE ACCOUNT CONFIRMATION */}
      {/* ==================================================== */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0c121e] border border-rose-800/80 rounded-2xl shadow-2xl p-6 space-y-5 font-mono">
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-rose-200 font-sans text-xs leading-relaxed">
              WARNING: This action cannot be reversed. Your account (@{user.username || 'user'}) and all watchlists, alerts, and sessions will be destroyed immediately.
            </p>

            <div className="space-y-3 font-sans">
              <div>
                <label className="text-slate-300 text-xs block mb-1">
                  Type <span className="text-rose-400 font-bold font-mono">DELETE MY ACCOUNT</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={e => setDeleteConfirmationInput(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="w-full p-2.5 rounded-xl bg-[#080d16] border border-rose-700/50 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs block mb-1">Confirm your account password:</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-[#080d16] border border-[#1f2d47] text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-[#141e30] text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmationInput !== 'DELETE MY ACCOUNT' || !deletePassword}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs"
              >
                {isDeleting ? 'Deleting...' : 'Erase Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
