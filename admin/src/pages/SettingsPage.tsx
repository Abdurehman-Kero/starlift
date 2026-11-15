import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../services/api';
import {
  ShieldCheck,
  Calendar,
  Layers,
  Radio,
  Save,
  AlertTriangle,
  RotateCcw,
  Bot,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingsForm {
  TELEGRAM_CHANNEL_ID: string;
  CHALLENGE_START_DATE: string;
  CHALLENGE_END_DATE: string;
  REFERRAL_WEIGHT: string;
  REACTION_WEIGHT: string;
  MIN_REFERRALS_FOR_ELIGIBILITY: string;
  CAMPAIGN_STATUS: string;
  BOT_DESCRIPTION?: string;
  BOT_SHORT_DESCRIPTION?: string;
}

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<SettingsForm>({
    TELEGRAM_CHANNEL_ID: '',
    CHALLENGE_START_DATE: '2026-11-15T00:00:00.000Z',
    CHALLENGE_END_DATE: '2026-11-30T23:59:59.000Z',
    REFERRAL_WEIGHT: '70',
    REACTION_WEIGHT: '30',
    MIN_REFERRALS_FOR_ELIGIBILITY: '1',
    CAMPAIGN_STATUS: 'active',
    BOT_DESCRIPTION:
      '🌟 Welcome to NilePixel StarLift!\n\nJoin the official StarLift Project Showcase Challenge (Nov 15 – Nov 30, 2026) by NilePixel Technologies.\n\n🚀 What this bot does:\n• Generate your unique channel invitation link\n• Automatically tracks friends who join @NilePixelTech\n• Dynamic 70/30 scoring (70% referrals + 30% project reactions)\n• Live competition leaderboard & statistics\n\nTap "Start" below to get your personal referral code and invite link!',
    BOT_SHORT_DESCRIPTION:
      'Official referral & leaderboard bot for the NilePixel StarLift Project Showcase Challenge (Nov 15–30, 2026).',
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [syncingBot, setSyncingBot] = useState<boolean>(false);

  const { data: res } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  useEffect(() => {
    if (res?.data?.data) {
      setFormData((prev) => ({
        ...prev,
        ...res.data.data,
      }));
    }
  }, [res]);

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsApi.update(key, value),
    onSuccess: (_, variables) => {
      toast.success(`${variables.key.replace(/_/g, ' ')} updated successfully.`);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      setSavingKey(null);
    },
    onError: () => {
      toast.error('Failed to update setting.');
      setSavingKey(null);
    },
  });

  const handleSave = (key: keyof SettingsForm) => {
    setSavingKey(key);
    saveMutation.mutate({ key, value: formData[key] || '' });
  };

  const handleSyncBotProfile = async () => {
    setSyncingBot(true);
    try {
      // First save the descriptions if edited
      if (formData.BOT_DESCRIPTION) {
        await settingsApi.update('BOT_DESCRIPTION', formData.BOT_DESCRIPTION);
      }
      if (formData.BOT_SHORT_DESCRIPTION) {
        await settingsApi.update('BOT_SHORT_DESCRIPTION', formData.BOT_SHORT_DESCRIPTION);
      }

      const res = await settingsApi.syncBotProfile();
      if (res.data.success) {
        toast.success('Bot profile, commands, and descriptions synchronized with Telegram!');
      } else {
        toast.error(res.data.message || 'Failed to sync with Telegram.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to Telegram Bot API';
      toast.error(msg);
    } finally {
      setSyncingBot(false);
    }
  };

  const refWeight = parseInt(formData.REFERRAL_WEIGHT, 10) || 0;
  const reactWeight = parseInt(formData.REACTION_WEIGHT, 10) || 0;
  const totalWeight = refWeight + reactWeight;
  const weightsValid = totalWeight === 100;

  const resetWeights = () => {
    setFormData((prev) => ({
      ...prev,
      REFERRAL_WEIGHT: '70',
      REACTION_WEIGHT: '30',
    }));
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          Campaign Settings & Configuration
          <span className="badge-slate font-mono text-[11px]">Production</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure challenge timeline dates, scoring weights, and Telegram bot profile & channel.
        </p>
      </div>

      {/* Security Advisory */}
      <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-600">
          <p className="font-semibold text-slate-900">Environment Security Note</p>
          <p className="mt-0.5 leading-relaxed">
            Sensitive credentials (database connection URLs, Telegram Bot API token, and JWT signing keys)
            are securely isolated in the server runtime environment and never transmitted to the client.
          </p>
        </div>
      </div>

      {/* Section 1: Telegram Bot Profile & Synchronization */}
      <div className="surface-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Bot size={16} className="text-blue-600" />
              Telegram Bot Profile & Descriptions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize what contestants see when opening @NilePixelStarLiftBot in Telegram.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://t.me/NilePixelStarLiftBot"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-base btn-secondary text-xs"
            >
              Open Bot <ExternalLink size={12} />
            </a>
            <button
              onClick={handleSyncBotProfile}
              disabled={syncingBot}
              className="btn-base btn-primary text-xs"
              title="Push descriptions and commands to Telegram Bot API"
            >
              <RefreshCw size={12} className={syncingBot ? 'animate-spin' : ''} />
              {syncingBot ? 'Syncing to Telegram…' : 'Sync to Telegram'}
            </button>
          </div>
        </div>

        {/* Bot Profile Fields */}
        <div className="space-y-4 pt-2">
          {/* Bot Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800">
                Bot Description (Shown in empty chat before user taps "Start")
              </label>
              <button
                onClick={() => handleSave('BOT_DESCRIPTION')}
                disabled={savingKey === 'BOT_DESCRIPTION'}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {savingKey === 'BOT_DESCRIPTION' ? 'Saving…' : 'Save Text'}
              </button>
            </div>
            <textarea
              rows={5}
              value={formData.BOT_DESCRIPTION}
              onChange={(e) =>
                setFormData({ ...formData, BOT_DESCRIPTION: e.target.value })
              }
              className="input-base text-xs font-mono py-2 leading-relaxed"
              placeholder="Enter full bot description…"
            />
          </div>

          {/* Bot Short Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800">
                Short Description (Profile "About" text & share preview)
              </label>
              <button
                onClick={() => handleSave('BOT_SHORT_DESCRIPTION')}
                disabled={savingKey === 'BOT_SHORT_DESCRIPTION'}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {savingKey === 'BOT_SHORT_DESCRIPTION' ? 'Saving…' : 'Save Text'}
              </button>
            </div>
            <input
              type="text"
              value={formData.BOT_SHORT_DESCRIPTION}
              onChange={(e) =>
                setFormData({ ...formData, BOT_SHORT_DESCRIPTION: e.target.value })
              }
              className="input-base text-xs py-2"
              placeholder="Enter 1-sentence summary for Telegram profile…"
            />
          </div>

          {/* Bot Command List Summary */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
            <span className="font-semibold text-slate-800 block mb-1">
              Registered Telegram Menu Commands:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-600">
              <div>• <span className="font-bold text-slate-900">/start</span> - Register & welcome menu</div>
              <div>• <span className="font-bold text-slate-900">/mylink</span> - Personal invite link</div>
              <div>• <span className="font-bold text-slate-900">/stats</span> - Personal referrals & rank</div>
              <div>• <span className="font-bold text-slate-900">/leaderboard</span> - Top 10 standings</div>
              <div>• <span className="font-bold text-slate-900">/help</span> - 70/30 scoring rules & guide</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Campaign Status */}
      <div className="surface-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Campaign Lifecycle Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control bot invitation link creation and participant registrations.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={formData.CAMPAIGN_STATUS}
              onChange={(e) =>
                setFormData({ ...formData, CAMPAIGN_STATUS: e.target.value })
              }
              className="input-base text-xs py-2 flex-1 sm:w-36 bg-white"
            >
              <option value="active">Active (Live)</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <button
              onClick={() => handleSave('CAMPAIGN_STATUS')}
              disabled={savingKey === 'CAMPAIGN_STATUS'}
              className="btn-base btn-primary text-xs shrink-0"
            >
              <Save size={13} />
              {savingKey === 'CAMPAIGN_STATUS' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Dynamic Scoring Weights */}
      <div className="surface-card p-5 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              Challenge Scoring Weights
            </h2>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                weightsValid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              Sum: {totalWeight}% {weightsValid ? '✓' : '(Must be 100%)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic ratio for calculating final scores. Default official ratio is 70% referrals and 30% reactions.
          </p>
        </div>

        {/* Visual Ratio Bar */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
            <div
              style={{ width: `${Math.min(100, Math.max(0, refWeight))}%` }}
              className="bg-blue-600 h-full transition-all duration-300"
            />
            <div
              style={{ width: `${Math.min(100, Math.max(0, reactWeight))}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
              Referrals: {refWeight}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Reactions: {reactWeight}%
            </span>
          </div>
        </div>

        {!weightsValid && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-600 shrink-0" />
              <span>Weights currently sum to {totalWeight}%. They should sum to exactly 100%.</span>
            </div>
            <button
              onClick={resetWeights}
              className="text-rose-700 hover:text-rose-900 font-semibold underline inline-flex items-center gap-1 shrink-0"
            >
              <RotateCcw size={11} /> Reset to 70/30
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Referral Weight Input */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Referral Weight (%)
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Weight given to verified channel joins via personal link.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={formData.REFERRAL_WEIGHT}
                onChange={(e) =>
                  setFormData({ ...formData, REFERRAL_WEIGHT: e.target.value })
                }
                className="input-base text-xs py-1.5 font-mono"
              />
              <button
                onClick={() => handleSave('REFERRAL_WEIGHT')}
                disabled={savingKey === 'REFERRAL_WEIGHT'}
                className="btn-base btn-primary text-xs shrink-0"
              >
                Save
              </button>
            </div>
          </div>

          {/* Reaction Weight Input */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Reaction Weight (%)
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Weight given to showcased project post reactions in channel.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={formData.REACTION_WEIGHT}
                onChange={(e) =>
                  setFormData({ ...formData, REACTION_WEIGHT: e.target.value })
                }
                className="input-base text-xs py-1.5 font-mono"
              />
              <button
                onClick={() => handleSave('REACTION_WEIGHT')}
                disabled={savingKey === 'REACTION_WEIGHT'}
                className="btn-base btn-primary text-xs shrink-0"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Telegram Channel Integration */}
      <div className="surface-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="max-w-md">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Radio size={16} className="text-blue-600" />
              Telegram Channel Username or ID
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Target channel where participant invite links are generated (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">@NilePixelTech</code> or numeric ID like <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">-100...</code>). Bot must be an administrator with "Invite Users via Link" rights.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={formData.TELEGRAM_CHANNEL_ID}
              onChange={(e) =>
                setFormData({ ...formData, TELEGRAM_CHANNEL_ID: e.target.value })
              }
              placeholder="@NilePixelTech"
              className="input-base text-xs py-2 sm:w-60 font-mono"
            />
            <button
              onClick={() => handleSave('TELEGRAM_CHANNEL_ID')}
              disabled={savingKey === 'TELEGRAM_CHANNEL_ID'}
              className="btn-base btn-primary text-xs shrink-0"
            >
              <Save size={13} />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Section 5: Competition Timeline Dates */}
      <div className="surface-card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" />
            Showcase Timeline Dates
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Official challenge duration: November 15 to November 30, 2026.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Challenge Start Date
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={formData.CHALLENGE_START_DATE}
                onChange={(e) =>
                  setFormData({ ...formData, CHALLENGE_START_DATE: e.target.value })
                }
                className="input-base text-xs py-1.5 font-mono"
              />
              <button
                onClick={() => handleSave('CHALLENGE_START_DATE')}
                disabled={savingKey === 'CHALLENGE_START_DATE'}
                className="btn-base btn-primary text-xs shrink-0"
              >
                Save
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="text-xs font-semibold text-slate-800 block mb-1">
              Challenge End Date (Deadline)
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={formData.CHALLENGE_END_DATE}
                onChange={(e) =>
                  setFormData({ ...formData, CHALLENGE_END_DATE: e.target.value })
                }
                className="input-base text-xs py-1.5 font-mono"
              />
              <button
                onClick={() => handleSave('CHALLENGE_END_DATE')}
                disabled={savingKey === 'CHALLENGE_END_DATE'}
                className="btn-base btn-primary text-xs shrink-0"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
