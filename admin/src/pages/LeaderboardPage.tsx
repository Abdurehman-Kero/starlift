import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaderboardApi } from '../services/api';
import {
  Edit2,
  Check,
  X,
  Download,
  Search,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface LeaderboardItem {
  rank: number;
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  referralCode: string;
  referralCount: number;
  reactionCount: number;
  referralScore: number;
  reactionScore: number;
  finalScore: number;
}

export const LeaderboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editReactions, setEditReactions] = useState<number>(0);
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => leaderboardApi.get(),
  });

  const updateReactionsMutation = useMutation({
    mutationFn: ({ participantId, reactionCount }: { participantId: number; reactionCount: number }) =>
      leaderboardApi.updateReactions(participantId, reactionCount),
    onSuccess: () => {
      toast.success('Reactions updated and leaderboard recalculated.');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
    },
    onError: () => {
      toast.error('Failed to update reactions.');
    },
  });

  const leaderboard: LeaderboardItem[] = res?.data?.data || [];
  const filteredLeaderboard = leaderboard.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${item.firstName} ${item.lastName || ''}`.toLowerCase();
    const username = (item.username || '').toLowerCase();
    const code = item.referralCode.toLowerCase();
    return fullName.includes(q) || username.includes(q) || code.includes(q);
  });

  const topThree = leaderboard.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];

  const startEditing = (item: LeaderboardItem) => {
    setEditingId(item.id);
    setEditReactions(item.reactionCount);
  };

  const saveEditing = (participantId: number) => {
    if (editReactions < 0) {
      toast.error('Reactions cannot be negative.');
      return;
    }
    updateReactionsMutation.mutate({ participantId, reactionCount: editReactions });
  };

  const exportCSV = () => {
    if (leaderboard.length === 0) {
      toast.error('No leaderboard data to export.');
      return;
    }
    const headers = [
      'Rank',
      'Participant ID',
      'Telegram ID',
      'Name',
      'Username',
      'Referral Code',
      'Referral Count',
      'Referral Score (70%)',
      'Reaction Count',
      'Reaction Score (30%)',
      'Final Composite Score',
    ];
    const rows = leaderboard.map((item) => [
      item.rank,
      item.id,
      item.telegramId,
      `"${item.firstName} ${item.lastName || ''}".trim()`,
      item.username ? `@${item.username}` : '',
      item.referralCode,
      item.referralCount,
      item.referralScore.toFixed(2),
      item.reactionCount,
      item.reactionScore.toFixed(2),
      item.finalScore.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `nilepixel_starlift_leaderboard_${format(new Date(), 'yyyy-MM-dd')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Leaderboard CSV exported!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Challenge Scoring & Leaderboard
            <span className="badge-blue text-[11px] font-semibold py-0.5">
              Dynamic 70/30 Formula
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official rankings for the StarLift Showcase Challenge (Nov 15 – Nov 30, 2026).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search contestant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-8 text-xs py-1.5"
            />
          </div>

          <button
            onClick={exportCSV}
            className="btn-base btn-secondary text-xs shrink-0"
            title="Download leaderboard CSV"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Formula Explanation Card */}
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          <Layers size={15} className="text-blue-600" />
          Scoring Methodology Breakdown
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/70">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900">1. Channel Referrals</span>
              <span className="badge-blue text-[10px] font-bold">70% Weight</span>
            </div>
            <p className="font-mono text-slate-600 text-[11px] bg-white px-2 py-1 rounded border border-slate-200 mt-1.5">
              (participantRef / maxRef) × 100 × 0.70
            </p>
            <p className="text-slate-400 text-[11px] mt-1.5 leading-snug">
              Automatically credited when invited members join via participant's personal link.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/70">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900">2. Project Reactions</span>
              <span className="badge-emerald text-[10px] font-bold">30% Weight</span>
            </div>
            <p className="font-mono text-slate-600 text-[11px] bg-white px-2 py-1 rounded border border-slate-200 mt-1.5">
              (participantReact / maxReact) × 100 × 0.30
            </p>
            <p className="text-slate-400 text-[11px] mt-1.5 leading-snug">
              Telegram channel reactions on the participant's showcased project post.
            </p>
          </div>

          <div className="p-3.5 bg-blue-50/50 rounded-lg border border-blue-200/60">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-blue-950">3. Final Composite Score</span>
              <span className="badge-slate text-[10px] font-bold font-mono">100 max</span>
            </div>
            <p className="font-mono text-blue-700 font-bold text-[11px] bg-white px-2 py-1 rounded border border-blue-200 mt-1.5">
              referralScore(70%) + reactionScore(30%)
            </p>
            <p className="text-blue-600/80 text-[11px] mt-1.5 leading-snug">
              Top 3 participants at deadline (Nov 30) win the StarLift Showcase prizes.
            </p>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && !search && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((item, idx) => {
            const displayName = item.username
              ? `@${item.username}`
              : `${item.firstName} ${item.lastName || ''}`.trim();

            const styles = [
              {
                border: 'border-amber-300',
                badge: 'bg-amber-100 text-amber-800 border-amber-200',
                title: '1st Place Champion',
              },
              {
                border: 'border-slate-300',
                badge: 'bg-slate-100 text-slate-800 border-slate-200',
                title: '2nd Place Runner-Up',
              },
              {
                border: 'border-orange-300',
                badge: 'bg-orange-100 text-orange-800 border-orange-200',
                title: '3rd Place Finalist',
              },
            ];

            return (
              <div
                key={item.id}
                className={`surface-card p-5 border-2 ${styles[idx].border} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{medals[idx]}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[idx].badge}`}
                    >
                      {styles[idx].title}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-3 truncate leading-snug">
                    {displayName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Code: {item.referralCode}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Referrals:</span>
                    <span className="font-semibold text-slate-800">
                      {item.referralCount} ({item.referralScore.toFixed(1)} pts)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Reactions:</span>
                    <span className="font-semibold text-slate-800">
                      {item.reactionCount} ({item.reactionScore.toFixed(1)} pts)
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold">
                    <span className="text-slate-700">Total Score:</span>
                    <span className="text-blue-600 font-mono text-sm">
                      {item.finalScore.toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              All Ranked Participants
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live sorted by composite score. Click the reactions column to edit post reactions.
            </p>
          </div>
          <span className="badge-slate font-mono text-xs">
            {filteredLeaderboard.length} participants
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-16">
                  Rank
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Participant
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Referral Code
                </th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Referrals (70%)
                </th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Reactions (30%)
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Final Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                    Computing leaderboard standings…
                  </td>
                </tr>
              ) : filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                    {search ? `No participants matching "${search}"` : 'No ranked participants yet.'}
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((item) => {
                  const fullName = `${item.firstName} ${item.lastName || ''}`.trim();
                  const usernameText = item.username ? `@${item.username}` : null;
                  const isTopThree = item.rank <= 3;
                  const medal = item.rank <= 3 ? medals[item.rank - 1] : null;
                  const isEditing = editingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isTopThree ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-5 py-3.5 text-xs font-mono font-bold">
                        {medal ? (
                          <span className="flex items-center gap-1 text-base">
                            {medal}
                            <span className="text-xs text-slate-600 font-bold">#{item.rank}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">#{item.rank}</span>
                        )}
                      </td>

                      {/* Participant Name & Username */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-semibold text-slate-900 leading-snug">{fullName}</div>
                        {usernameText && (
                          <div className="text-[11px] text-blue-600 font-medium">{usernameText}</div>
                        )}
                      </td>

                      {/* Referral Code */}
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {item.referralCode}
                        </span>
                      </td>

                      {/* Referrals (70%) */}
                      <td className="px-5 py-3.5 text-center text-xs">
                        <div className="font-bold text-slate-900 font-mono">
                          {item.referralCount}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.referralScore.toFixed(1)} pts
                        </div>
                      </td>

                      {/* Reactions (30%) - Interactive Editor */}
                      <td className="px-5 py-3.5 text-center text-xs">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={editReactions}
                              onChange={(e) =>
                                setEditReactions(parseInt(e.target.value, 10) || 0)
                              }
                              className="w-16 px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none text-center font-mono"
                              autoFocus
                            />
                            <button
                              onClick={() => saveEditing(item.id)}
                              disabled={updateReactionsMutation.isPending}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              title="Save reactions"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditing(item)}
                            className="inline-flex flex-col items-center cursor-pointer group px-2 py-0.5 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                            title="Click to edit reactions"
                          >
                            <div className="flex items-center gap-1 font-bold text-slate-900 font-mono">
                              <span>{item.reactionCount}</span>
                              <Edit2
                                size={11}
                                className="text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.reactionScore.toFixed(1)} pts
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Final Composite Score */}
                      <td className="px-5 py-3.5 text-right text-xs">
                        <span className="font-mono font-bold text-blue-600 text-sm">
                          {item.finalScore.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">pts</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
