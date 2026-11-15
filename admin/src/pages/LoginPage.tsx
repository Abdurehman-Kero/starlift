import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { systemApi } from '../services/api';
import {
  AlertCircle,
  AlertTriangle,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SystemStatus {
  server: string;
  database: {
    configured: boolean;
    connected: boolean;
    error: string | null;
  };
  bot: {
    configured: boolean;
    running: boolean;
    error: string | null;
  };
  envIssues: string[];
}

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemCheckFailed, setSystemCheckFailed] = useState<boolean>(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    systemApi
      .status()
      .then((res) => {
        if (res.data.success && res.data.data) {
          setSystemStatus(res.data.data);
          setSystemCheckFailed(false);
        }
      })
      .catch(() => {
        setSystemCheckFailed(true);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      const msg = 'Please enter both your email address and password.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Authenticated successfully.');
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Invalid administrator credentials.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-xs mb-3">
            ✦
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            NilePixel StarLift
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Project Showcase Challenge Admin Portal
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Server Connectivity Alert */}
        {systemCheckFailed && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-800">
            <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-rose-900">Backend Server Offline</p>
              <p className="mt-0.5 leading-relaxed">
                Cannot reach backend API at <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">http://localhost:3001</code>. Start it by running <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">npm run dev</code> inside <code className="font-mono">backend/</code>.
              </p>
            </div>
          </div>
        )}

        {/* Database or Bot Configuration Notice */}
        {systemStatus && (!systemStatus.database.connected || systemStatus.envIssues?.length > 0) && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-800">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-900">System Notice</p>
              {!systemStatus.database.connected && (
                <p>Database is not connected: {systemStatus.database.error || 'Check Supabase credentials.'}</p>
              )}
              {systemStatus.envIssues?.map((issue, idx) => (
                <p key={idx}>• {issue}</p>
              ))}
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="surface-card p-7 sm:p-8 shadow-xs">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="contact@nilexpixel.et"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base pl-9 text-xs py-2.5"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pl-9 text-xs py-2.5"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-base btn-primary w-full py-2.5 text-xs font-semibold mt-2"
            >
              {submitting ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick Credential Hint for Local Development */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Default Seed Account:</span>
            <code className="font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              contact@nilexpixel.et
            </code>
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-slate-400" />
          <span>Encrypted Session · NilePixel Technologies</span>
        </div>
      </div>
    </div>
  );
};
