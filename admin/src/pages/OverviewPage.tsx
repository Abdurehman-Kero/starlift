import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi, leaderboardApi } from '../services/api';
import {
  Users,
  GitBranch,
  Trophy,
  UserCheck,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface OverviewStats {
  totalParticipants: number;
  totalReferrals: number;
  participantsWithReferrals: number;
  totalChannelMembers: number;
  recentReferrals: Array<{
    id: number;
    createdAt: string;
    referrer: { username: string | null; firstName: string };
    referred: { username: string | null; firstName: string };
  }>;
}

interface LeaderboardItem {
  rank: number;
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  referralCount: number;
  reactionCount: number;
  referralScore: number;
  reactionScore: number;
  finalScore: number;
}

export const OverviewPage: React.FC = () => {
  const [chartDays, setChartDays] = useState<number>(14);

  const { data: statsRes, isLoading: loadingStats } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => statsApi.overview(),
  });

  const { data: dailyRes, isLoading: loadingDaily } = useQuery({
    queryKey: ['stats-daily', chartDays],
    queryFn: () => statsApi.daily(chartDays),
  });

  const { data: leaderboardRes } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => leaderboardApi.get(),
  });

  const stats: OverviewStats | undefined = statsRes?.data?.data;
  const dailyData: Array<{ date: string; registrations: number; referrals: number }> =
    dailyRes?.data?.data || [];
  const leaderboard: LeaderboardItem[] = leaderboardRes?.data?.data || [];
  const topThree = leaderboard.slice(0, 3);

  // Conversion rate: participants with referrals / total participants
  const referralConversion = stats?.totalParticipants
    ? Math.round((stats.participantsWithReferrals / stats.totalParticipants) * 100)
    : 0;

  const statCards = [
    {
      label: 'Registered Participants',
      value: stats?.totalParticipants ?? 0,
      sublabel: 'Active bot users',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      label: 'Confirmed Referrals',
      value: stats?.totalReferrals ?? 0,
      sublabel: 'Verified channel joins',
      icon: GitBranch,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      label: 'Channel Members via Link',
      value: stats?.totalChannelMembers ?? 0,
      sublabel: 'Direct acquisitions',
      icon: UserCheck,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      label: 'Active Referrers',
      value: stats?.participantsWithReferrals ?? 0,
      sublabel: `${referralConversion}% participant conversion`,
      icon: Trophy,
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Challenge Overview
            <span className="badge-emerald text-[11px] font-semibold py-0.5">
              Live Competition
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time participant growth, invitation performance, and leaderboard standings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/leaderboard"
            className="btn-base btn-secondary text-xs"
          >
            <Trophy size={14} className="text-amber-500" />
            Full Leaderboard
          </Link>
          <Link
            to="/participants"
            className="btn-base btn-primary text-xs"
          >
            <Users size={14} />
            View Participants
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="surface-card surface-card-hover p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-2 tracking-tight tabular-nums">
                    {loadingStats ? '—' : card.value.toLocaleString()}
                  </p>
                </div>
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${card.iconBg}`}
                >
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                <TrendingUp size={12} className="text-slate-400" />
                <span>{card.sublabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Top 3 Podium Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main 14-day Activity Area Chart */}
        <div className="lg:col-span-2 surface-card p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Registration & Referral Trends
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daily volume of participant sign-ups vs channel joins
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Legend */}
              <div className="hidden sm:flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                  Sign-ups
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                  Referrals
                </span>
              </div>

              {/* Range Filters */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => setChartDays(days)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      chartDays === days
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-64 w-full mt-2">
            {loadingDaily ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading activity trends…
              </div>
            ) : dailyData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                <span>No daily activity recorded in this period</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(val) => {
                      try {
                        return format(new Date(val), 'MMM d');
                      } catch {
                        return val;
                      }
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      fontSize: '12px',
                    }}
                    labelFormatter={(val: any) => {
                      if (!val) return '';
                      try {
                        return format(new Date(String(val)), 'EEE, MMM d, yyyy');
                      } catch {
                        return String(val);
                      }
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="registrations"
                    name="Registrations"
                    stroke="#2563eb"
                    fill="url(#colorRegistrations)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="referrals"
                    name="Referrals"
                    stroke="#059669"
                    fill="url(#colorReferrals)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 3 Leaderboard Podium Card */}
        <div className="surface-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-500" />
                Current Top 3 Leaders
              </h2>
              <Link
                to="/leaderboard"
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              Weighted scoring (70% referrals + 30% reactions)
            </p>

            {topThree.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No participants ranked yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topThree.map((item, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const medalBorders = [
                    'border-amber-200 bg-amber-50/40',
                    'border-slate-200 bg-slate-50/60',
                    'border-orange-200 bg-orange-50/30',
                  ];
                  const displayName = item.username
                    ? `@${item.username}`
                    : `${item.firstName} ${item.lastName || ''}`.trim();

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border flex items-center justify-between transition-all ${medalBorders[idx]}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{medals[idx]}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">{item.referralCount}</span> refs ·{' '}
                            <span className="font-semibold text-slate-700">{item.reactionCount}</span> react
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-blue-600 font-mono">
                          {item.finalScore.toFixed(1)} pts
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">Rank #{item.rank}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Challenge formula:</span>
            <span className="font-mono text-slate-700 font-semibold text-[10px]">
              70% Ref + 30% React
            </span>
          </div>
        </div>
      </div>

      {/* Recent Referral Activity Feed */}
      <div className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Recent Channel Referral Activity
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live log of members joining via participant personal invitation links
            </p>
          </div>
          <Link
            to="/referrals"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Audit Log <ArrowRight size={12} />
          </Link>
        </div>

        {!stats?.recentReferrals || stats.recentReferrals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No referral joins recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Inviting Participant
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    New Member
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Verification
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {stats.recentReferrals.map((item) => {
                  const refName = item.referrer.username
                    ? `@${item.referrer.username}`
                    : item.referrer.firstName;
                  const joinedName = item.referred.username
                    ? `@${item.referred.username}`
                    : item.referred.firstName;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                            {refName.replace('@', '').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{refName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">→</span>
                          <span className="font-medium text-slate-700">{joinedName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 font-mono">
                        {format(new Date(item.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="badge-emerald text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                          Confirmed Join
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
