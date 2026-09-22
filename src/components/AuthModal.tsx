import { Key, Lock, Mail, ShieldCheck, User as UserIcon, X, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@cryptointelligence.ai');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@cryptointelligence.ai', password: 'demo1234' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0c121e] border border-[#22314d] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#080d16] border-b border-[#1b273d] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span className="font-mono font-bold text-sm text-white tracking-wider">
              {mode === 'login' ? 'TERMINAL ACCESS' : 'REGISTER ANALYST'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Quick Demo Access */}
          <div className="p-3 bg-[#111928] border border-[#1e2a3f] rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant Demo Analyst</span>
              </div>
              <div className="text-[11px] text-slate-400">One-click authenticated access</div>
            </div>
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition-all active:scale-95"
            >
              1-Click Demo
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#1b253b]"></div>
            <span className="flex-shrink mx-2 text-[10px] text-slate-500 uppercase tracking-widest font-mono">Or Credentials</span>
            <div className="flex-grow border-t border-[#1b253b]"></div>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="text-[11px] uppercase font-mono text-slate-400">Full Name / Handle</label>
                <div className="relative mt-1">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Quantitative Analyst"
                    className="w-full bg-[#080d16] border border-[#1e2a3f] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] uppercase font-mono text-slate-400">Email Address</label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="analyst@domain.com"
                  className="w-full bg-[#080d16] border border-[#1e2a3f] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase font-mono text-slate-400">Password</label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#080d16] border border-[#1e2a3f] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold tracking-wide transition-all shadow-lg shadow-cyan-600/20 active:scale-95"
            >
              {loading ? 'Authenticating...' : mode === 'login' ? 'Authenticate Terminal Session' : 'Create Analyst Account'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="text-xs text-cyan-400 hover:underline"
            >
              {mode === 'login' ? "Don't have an analyst account? Register here" : 'Already registered? Login to existing session'}
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#080d16] border-t border-[#172033] text-[10px] text-center text-slate-500">
          Analytical platform authentication. No financial custody or wallet keys required.
        </div>
      </div>
    </div>
  );
};
