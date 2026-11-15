import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralsApi } from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  XCircle,
  Copy,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ReferralItem {
  id: number;
  status: string;
  joinedAt: string;
  createdAt: string;
  referrer: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string;
  };
  referred: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string;
  };
  invitationLink?: {
    inviteLink: string;
  } | null;
}

export const ReferralsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['referrals', page, statusFilter],
    queryFn: () =>
      referralsApi.list({
        page,
        limit: 15,
        status: statusFilter || undefined,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      referralsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Referral verification status updated.');
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: () => {
      toast.error('Failed to update referral status.');
    },
  });

  const referrals: ReferralItem[] = res?.data?.data?.referrals || [];
  const total = res?.data?.data?.total || 0;
  const totalPages = res?.data?.data?.totalPages || 1;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="badge-emerald text-[11px]">
            <Check size={11} className="text-emerald-600" />
            Confirmed Join
          </span>
        );
      case 'rejected':
        return (
          <span className="badge-rose text-[11px]">
            <XCircle size={11} className="text-rose-600" />
            Rejected / Left
          </span>
        );
      default:
        return (
          <span className="badge-amber text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
            Pending Verification
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Referrals & Channel Joins
            <span className="badge-slate text-[11px] font-mono font-semibold">
              {total.toLocaleString()} total
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete audit trail of participant invitation links and verified Telegram channel joins.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          {[
            { label: 'All', value: '' },
            { label: 'Confirmed', value: 'confirmed' },
            { label: 'Pending', value: 'pending' },
            { label: 'Rejected', value: 'rejected' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                statusFilter === tab.value
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Invited By (Referrer)
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  New Member (Referred)
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Link Used
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Joined Timestamp
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Audit Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                    Loading referral audit log…
                  </td>
                </tr>
              ) : referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                    No referral joins found matching the selected filter.
                  </td>
                </tr>
              ) : (
                referrals.map((item) => {
                  const refName = item.referrer.username
                    ? `@${item.referrer.username}`
                    : item.referrer.firstName;
                  const joinedName = item.referred.username
                    ? `@${item.referred.username}`
                    : item.referred.firstName;
                  const linkUrl = item.invitationLink?.inviteLink;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Referrer */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {refName.replace('@', '').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{refName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {item.referrer.telegramId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Referred Member */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="flex items-center gap-2">
                          <ArrowRight size={13} className="text-slate-300 shrink-0" />
                          <div>
                            <div className="font-medium text-slate-800">{joinedName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {item.referred.telegramId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Link Used */}
                      <td className="px-5 py-3.5 text-xs">
                        {linkUrl ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-blue-600 hover:text-blue-800 truncate max-w-[120px] inline-flex items-center gap-1 hover:underline"
                              title={linkUrl}
                            >
                              Invite Link <ExternalLink size={10} />
                            </a>
                            <button
                              onClick={() => copyToClipboard(linkUrl, 'Invite link')}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copy URL"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Personal Link</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                        {format(new Date(item.joinedAt || item.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-xs">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Admin Override Actions */}
                      <td className="px-5 py-3.5 text-right text-xs">
                        <div className="inline-flex items-center gap-1">
                          {item.status !== 'confirmed' && (
                            <button
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: item.id,
                                  status: 'confirmed',
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                              className="btn-base py-1 px-2 text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                              title="Confirm referral"
                            >
                              <Check size={11} />
                              Confirm
                            </button>
                          )}
                          {item.status !== 'rejected' && (
                            <button
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: item.id,
                                  status: 'rejected',
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                              className="btn-base py-1 px-2 text-[11px] bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                              title="Reject / Revoke referral"
                            >
                              <XCircle size={11} />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-white">
          <div>
            Showing <span className="font-semibold text-slate-800">{referrals.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{total}</span> referral events
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-base btn-secondary py-1 px-2 text-xs disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-base btn-secondary py-1 px-2 text-xs disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
