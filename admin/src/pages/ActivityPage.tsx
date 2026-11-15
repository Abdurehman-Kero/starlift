import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

interface ActivityItem {
  id: number;
  adminEmail: string | null;
  participantId: number | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  participant?: {
    id: number;
    username: string | null;
    firstName: string;
  } | null;
}

export const ActivityPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState<string>('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['activity', page],
    queryFn: () => activityApi.list({ page, limit: 25 }),
  });

  const logs: ActivityItem[] = res?.data?.data?.logs || [];
  const total = res?.data?.data?.total || 0;
  const totalPages = res?.data?.data?.totalPages || 1;

  const filteredLogs = logs.filter((log) => {
    if (!filterAction) return true;
    return log.action.toUpperCase().includes(filterAction.toUpperCase());
  });

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('REGISTER') || act.includes('JOIN')) {
      return (
        <span className="badge-blue text-[11px] font-mono">
          {action}
        </span>
      );
    }
    if (act.includes('REFERRAL') || act.includes('CONFIRM')) {
      return (
        <span className="badge-emerald text-[11px] font-mono">
          {action}
        </span>
      );
    }
    if (act.includes('VERIFY') || act.includes('SUBMISSION')) {
      return (
        <span className="badge-emerald text-[11px] font-mono">
          {action}
        </span>
      );
    }
    if (act.includes('UPDATE') || act.includes('SETTING') || act.includes('REACTION')) {
      return (
        <span className="badge-amber text-[11px] font-mono">
          {action}
        </span>
      );
    }
    if (act.includes('REJECT') || act.includes('DELETE')) {
      return (
        <span className="badge-rose text-[11px] font-mono">
          {action}
        </span>
      );
    }
    return (
      <span className="badge-slate text-[11px] font-mono">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Audit & Activity Log
            <span className="badge-slate font-mono text-[11px]">
              {total.toLocaleString()} events
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable audit trail of administrator changes, participant sign-ups, and channel joins.
          </p>
        </div>

        {/* Action Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          {[
            { label: 'All Events', value: '' },
            { label: 'Registrations', value: 'REGISTER' },
            { label: 'Referrals', value: 'REFERRAL' },
            { label: 'Admin Actions', value: 'UPDATE' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setFilterAction(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                filterAction === tab.value
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
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-44">
                  Timestamp
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Action Event
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Initiated By
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Target Participant
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-xs text-slate-400">
                    Loading audit trail…
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-xs text-slate-400">
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const targetName = log.participant
                    ? log.participant.username
                      ? `@${log.participant.username}`
                      : log.participant.firstName
                    : log.participantId
                    ? `Participant #${log.participantId}`
                    : '—';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </td>

                      {/* Action Event Badge */}
                      <td className="px-5 py-3.5 text-xs">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Initiated By */}
                      <td className="px-5 py-3.5 text-xs">
                        {log.adminEmail ? (
                          <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                            {log.adminEmail}
                          </div>
                        ) : (
                          <span className="badge-slate text-[10px]">System / Telegram</span>
                        )}
                      </td>

                      {/* Target Participant */}
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-700">
                        {targetName}
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-mono">
                        <span className="break-all text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80">
                          {log.details || '—'}
                        </span>
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
            Showing <span className="font-semibold text-slate-800">{filteredLogs.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{total}</span> activity records
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
