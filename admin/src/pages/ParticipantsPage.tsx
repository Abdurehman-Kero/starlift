import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { participantsApi, submissionsApi } from '../services/api';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Check,
  Copy,
  Download,
  Clock,
  ArrowUpRight,
  Send,
  Plus,
  Edit2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ParticipantItem {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  referralCode: string;
  registeredAt: string;
  isCompetitor: boolean;
  _count: {
    referralsMade: number;
  };
  invitationLinks: Array<{
    id: number;
    inviteLink: string;
  }>;
  projectSubmission: {
    status: string;
    projectUrl?: string;
  } | null;
}

interface ParticipantDetail extends ParticipantItem {
  reactions?: Array<{
    id: number;
    reactionCount: number;
    source: string;
    recordedAt: string;
  }>;
  referralsMade: Array<{
    id: number;
    status: string;
    createdAt: string;
    referred: {
      telegramId: string;
      username: string | null;
      firstName: string;
    };
  }>;
  referralReceived: {
    referrer: {
      telegramId: string;
      username: string | null;
      firstName: string;
    };
  } | null;
  projectSubmission: {
    id: number;
    projectTitle?: string | null;
    projectUrl: string;
    description: string;
    imageUrl?: string | null;
    status: string;
    channelMessageId?: number | null;
    channelPostUrl?: string | null;
    publishedAt?: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
    reactions?: Array<{
      id: number;
      reactionCount: number;
      source: string;
      recordedAt: string;
    }>;
  } | null;
}

const resolveImageUrl = (img?: string | null): string => {
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}/api/submissions/image/${img}`;
};

export const ParticipantsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('registeredAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [roleFilter, setRoleFilter] = useState<'all' | 'contestants' | 'members'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['participants', page, search, sortBy, sortOrder, roleFilter],
    queryFn: () =>
      participantsApi.list({
        page,
        limit: 15,
        search,
        sortBy,
        sortOrder,
        isCompetitor: roleFilter === 'all' ? undefined : roleFilter === 'contestants',
      }),
  });

  const { data: detailRes, isLoading: loadingDetail } = useQuery({
    queryKey: ['participant-detail', selectedId],
    queryFn: () => participantsApi.get(selectedId!),
    enabled: selectedId !== null,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      submissionsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Submission verification status updated.');
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['participant-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update submission status.');
    },
  });

  const [isEditingSubmission, setIsEditingSubmission] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subUrl, setSubUrl] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subImage, setSubImage] = useState('');

  const publishMutation = useMutation({
    mutationFn: (submissionId: number) => submissionsApi.publish(submissionId),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Showcase published to @NilePixelTech and linked to contestant!');
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['participant-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to publish showcase to channel.');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (submissionId: number) => submissionsApi.unpublish(submissionId),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Showcase post deleted from @NilePixelTech.');
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['participant-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to remove showcase from channel.');
    },
  });

  const saveSubmissionMutation = useMutation({
    mutationFn: ({ participantId, data }: { participantId: number; data: any }) =>
      submissionsApi.save(participantId, data),
    onSuccess: () => {
      toast.success('Project submission saved!');
      setIsEditingSubmission(false);
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['participant-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save submission.');
    },
  });

  const participants: ParticipantItem[] = res?.data?.data?.participants || [];
  const total = res?.data?.data?.total || 0;
  const totalPages = res?.data?.data?.totalPages || 1;
  const detail: ParticipantDetail | undefined = detailRes?.data?.data;

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const exportCSV = () => {
    if (participants.length === 0) {
      toast.error('No participants to export.');
      return;
    }
    const headers = ['ID', 'Telegram ID', 'Name', 'Username', 'Referral Code', 'Referrals', 'Invite Link', 'Submission Status', 'Registered At'];
    const rows = participants.map((p) => [
      p.id,
      p.telegramId,
      `"${p.firstName} ${p.lastName || ''}".trim()`,
      p.username ? `@${p.username}` : '',
      p.referralCode,
      p._count?.referralsMade ?? 0,
      p.invitationLinks?.[0]?.inviteLink || '',
      p.projectSubmission?.status || 'none',
      p.registeredAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nilepixel_participants_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Participants CSV downloaded!');
  };

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return <span className="badge-slate text-[11px]">No Submission</span>;
    }
    if (status === 'published') {
      return (
        <span className="badge-blue text-[11px] font-semibold flex items-center gap-1">
          <Sparkles size={11} className="text-blue-600" />
          Published to Channel
        </span>
      );
    }
    if (status === 'verified' || status === 'approved') {
      return (
        <span className="badge-emerald text-[11px]">
          <Check size={11} className="text-emerald-600" />
          Verified
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="badge-rose text-[11px]">
          <X size={11} className="text-rose-600" />
          Rejected
        </span>
      );
    }
    return (
      <span className="badge-amber text-[11px]">
        <Clock size={11} className="text-amber-600" />
        Pending Review
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Participants Directory
            <span className="badge-slate text-[11px] font-mono font-semibold">
              {total.toLocaleString()} total
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered participants, personal invitation links, and StarLift project submissions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Role Filter Tabs */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => {
                setRoleFilter('all');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              All ({total})
            </button>
            <button
              onClick={() => {
                setRoleFilter('contestants');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                roleFilter === 'contestants'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              🏆 Contestants
            </button>
            <button
              onClick={() => {
                setRoleFilter('members');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                roleFilter === 'members'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              👥 Joined Members
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, handle, code…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-base pl-9 pr-8 text-xs py-2"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={exportCSV}
            className="btn-base btn-secondary text-xs shrink-0"
            title="Download CSV report"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  onClick={() => handleSort('firstName')}
                  className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
                >
                  Participant {sortBy === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Telegram ID
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Referral Code
                </th>
                <th
                  onClick={() => handleSort('registeredAt')}
                  className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
                >
                  Registered {sortBy === 'registeredAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Referrals
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Invite Link
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Project Status
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-slate-400">
                    Loading participants directory…
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-slate-400">
                    {search ? `No participants matching "${search}"` : 'No participants registered yet.'}
                  </td>
                </tr>
              ) : (
                participants.map((p) => {
                  const fullName = `${p.firstName} ${p.lastName || ''}`.trim();
                  const usernameText = p.username ? `@${p.username}` : null;
                  const activeLink = p.invitationLinks?.[0]?.inviteLink;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {p.firstName ? p.firstName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-snug flex items-center gap-1.5 flex-wrap">
                              <span>{fullName}</span>
                              {p.isCompetitor ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  🏆 Contestant
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  👥 Joined Member
                                </span>
                              )}
                            </div>
                            {usernameText ? (
                              <div className="text-[11px] text-blue-600 font-medium">{usernameText}</div>
                            ) : (
                              <div className="text-[11px] text-slate-400">No handle</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        <button
                          onClick={() => copyToClipboard(p.telegramId, 'Telegram ID')}
                          className="font-mono text-slate-600 hover:text-blue-600 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors group"
                          title="Click to copy"
                        >
                          <span>{p.telegramId}</span>
                          <Copy size={10} className="text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        <button
                          onClick={() => copyToClipboard(p.referralCode, 'Referral code')}
                          className="font-mono font-semibold text-slate-700 hover:text-blue-600 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100/70 border border-slate-200 group"
                          title="Click to copy"
                        >
                          <span>{p.referralCode}</span>
                          <Copy size={10} className="text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                        {format(new Date(p.registeredAt), 'MMM d, yyyy')}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className="badge-blue font-mono font-bold text-xs px-2.5">
                          {p._count?.referralsMade ?? 0}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        {activeLink ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={activeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-mono text-[11px] truncate max-w-[110px] inline-flex items-center gap-1 hover:underline"
                              title={activeLink}
                            >
                              Invite Link <ExternalLink size={10} />
                            </a>
                            <button
                              onClick={() => copyToClipboard(activeLink, 'Invite link')}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                              title="Copy URL"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Not generated</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        {getStatusBadge(p.projectSubmission?.status)}
                      </td>

                      <td className="px-5 py-3.5 text-right text-xs">
                        <button
                          onClick={() => setSelectedId(p.id)}
                          className="btn-base btn-secondary py-1 px-2.5 text-xs font-semibold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-white">
          <div>
            Showing <span className="font-semibold text-slate-800">{participants.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{total}</span> participants
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

      {/* Participant Slide-Over / Modal */}
      {selectedId !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedId(null)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    {detail?.firstName ? detail.firstName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      {detail ? `${detail.firstName} ${detail.lastName || ''}`.trim() : 'Participant'}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {detail?.username ? `@${detail.username}` : `TG ID: ${detail?.telegramId}`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {loadingDetail || !detail ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Loading participant details…
                  </div>
                ) : (
                  <>
                    {/* Basic Meta Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Telegram ID
                        </span>
                        <span className="font-mono font-medium text-slate-800 mt-1 block truncate">
                          {detail.telegramId}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Referral Code
                        </span>
                        <span className="font-mono font-bold text-slate-900 mt-1 block">
                          {detail.referralCode}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Confirmed Joins
                        </span>
                        <span className="font-mono font-bold text-blue-600 mt-1 block">
                          {detail._count?.referralsMade ?? 0}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Invited By
                        </span>
                        <span className="font-medium text-slate-800 mt-1 block truncate">
                          {detail.referralReceived?.referrer
                            ? detail.referralReceived.referrer.username
                              ? `@${detail.referralReceived.referrer.username}`
                              : detail.referralReceived.referrer.firstName
                            : 'Organic (Direct)'}
                        </span>
                      </div>
                    </div>

                    {/* Personal Invitation Link Card */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                        <span>Personal Invitation Link</span>
                        <span className="badge-blue text-[10px]">StarLift Tracked</span>
                      </div>
                      {detail.invitationLinks?.[0]?.inviteLink ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={detail.invitationLinks[0].inviteLink}
                            className="input-base font-mono text-xs py-1.5 bg-white select-all"
                          />
                          <button
                            onClick={() =>
                              copyToClipboard(
                                detail.invitationLinks[0].inviteLink,
                                'Invite link'
                              )
                            }
                            className="btn-base btn-secondary py-1.5 px-3 text-xs shrink-0"
                          >
                            <Copy size={13} />
                            Copy
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Participant has not generated an invitation link yet.
                        </p>
                      )}
                    </div>

                    {/* StarLift Project Submission & Showcase Section */}
                    <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Showcase Submission
                          </h3>
                          {getStatusBadge(detail.projectSubmission?.status)}
                        </div>

                        {!isEditingSubmission && (
                          <button
                            onClick={() => {
                              setSubTitle(detail.projectSubmission?.projectTitle || '');
                              setSubUrl(detail.projectSubmission?.projectUrl || '');
                              setSubDesc(detail.projectSubmission?.description || '');
                              setSubImage(detail.projectSubmission?.imageUrl || '');
                              setIsEditingSubmission(true);
                            }}
                            className="btn-base btn-secondary py-1 px-2.5 text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            {detail.projectSubmission ? (
                              <>
                                <Edit2 size={11} /> Edit Details
                              </>
                            ) : (
                              <>
                                <Plus size={11} /> Add Submission
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {isEditingSubmission ? (
                        <div className="space-y-3 pt-2 text-xs border-t border-slate-100">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                              Project Title
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. NilePay Gateway"
                              value={subTitle}
                              onChange={(e) => setSubTitle(e.target.value)}
                              className="input-base text-xs py-1.5"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                              Demo / Repository URL *
                            </label>
                            <input
                              type="url"
                              placeholder="https://myproject.com or https://github.com/..."
                              value={subUrl}
                              onChange={(e) => setSubUrl(e.target.value)}
                              className="input-base text-xs py-1.5 font-mono"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                              Showcase Banner / Image URL (Optional)
                            </label>
                            <input
                              type="url"
                              placeholder="https://example.com/screenshot.png or image link"
                              value={subImage}
                              onChange={(e) => setSubImage(e.target.value)}
                              className="input-base text-xs py-1.5 font-mono"
                            />
                            {subImage && (
                              <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden max-h-36 bg-slate-50 flex items-center justify-center p-1">
                                <img
                                  src={resolveImageUrl(subImage)}
                                  alt="Banner preview"
                                  className="max-h-36 object-contain rounded"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                              Description / Pitch *
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Brief pitch highlighting the innovation and solution..."
                              value={subDesc}
                              onChange={(e) => setSubDesc(e.target.value)}
                              className="input-base text-xs py-1.5"
                              required
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsEditingSubmission(false)}
                              className="btn-base btn-secondary py-1.5 px-3 text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!subUrl || !subDesc) {
                                  toast.error('URL and Description are required.');
                                  return;
                                }
                                saveSubmissionMutation.mutate({
                                  participantId: detail.id,
                                  data: {
                                    projectTitle: subTitle,
                                    projectUrl: subUrl,
                                    description: subDesc,
                                    imageUrl: subImage || null,
                                    status: detail.projectSubmission?.status ?? 'verified',
                                  },
                                });
                              }}
                              disabled={saveSubmissionMutation.isPending}
                              className="btn-base bg-blue-600 text-white hover:bg-blue-700 py-1.5 px-3 text-xs font-semibold"
                            >
                              Save Submission
                            </button>
                          </div>
                        </div>
                      ) : detail.projectSubmission ? (
                        <div className="space-y-3 text-xs">
                          {detail.projectSubmission.imageUrl && (
                            <div className="rounded-lg overflow-hidden border border-slate-200 max-h-48 bg-slate-50 flex items-center justify-center">
                              <img
                                src={resolveImageUrl(detail.projectSubmission.imageUrl)}
                                alt="Showcase banner"
                                className="w-full max-h-48 object-cover"
                              />
                            </div>
                          )}

                          {detail.projectSubmission.projectTitle && (
                            <div>
                              <span className="text-[11px] text-slate-500 font-medium block">
                                Project Title:
                              </span>
                              <span className="font-bold text-slate-900 text-sm">
                                {detail.projectSubmission.projectTitle}
                              </span>
                            </div>
                          )}

                          <div>
                            <span className="text-[11px] text-slate-500 font-medium block mb-1">
                              Live Demo / Repo URL:
                            </span>
                            <a
                              href={detail.projectSubmission.projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-mono font-medium hover:underline break-all"
                            >
                              {detail.projectSubmission.projectUrl}
                              <ArrowUpRight size={13} />
                            </a>
                          </div>

                          {detail.projectSubmission.description && (
                            <div>
                              <span className="text-[11px] text-slate-500 font-medium block mb-1">
                                Pitch / Description:
                              </span>
                              <div className="p-3 bg-slate-50 rounded-md border border-slate-200/80 text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {detail.projectSubmission.description}
                              </div>
                            </div>
                          )}

                          {/* Live Channel Post Link if Published */}
                          {detail.projectSubmission.channelPostUrl && (
                            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                              <div>
                                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                  <Sparkles size={13} className="text-blue-600" />
                                  Live on Channel (@NilePixelTech)
                                </span>
                                <a
                                  href={detail.projectSubmission.channelPostUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-blue-700 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  {detail.projectSubmission.channelPostUrl}
                                  <ExternalLink size={11} />
                                </a>
                                <span className="text-[10px] text-blue-600 block mt-1">
                                  ⚡ All channel emoji reactions are automatically synced & scored live
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <a
                                  href={detail.projectSubmission.channelPostUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-base bg-blue-600 text-white hover:bg-blue-700 py-1.5 px-3 text-xs shrink-0 self-start sm:self-center"
                                >
                                  View Post
                                </a>
                                <button
                                  onClick={() =>
                                    unpublishMutation.mutate(detail.projectSubmission!.id)
                                  }
                                  disabled={unpublishMutation.isPending}
                                  title="Delete post from @NilePixelTech and reset status"
                                  className="btn-base bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 py-1.5 px-2.5 text-xs font-semibold flex items-center gap-1"
                                >
                                  <Trash2 size={12} />
                                  Remove from Channel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Community Reactions Counter & Status */}
                          {detail.projectSubmission.channelPostUrl && (
                            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-center justify-between gap-3">
                              <div>
                                <span className="text-[11px] font-bold text-amber-900 block">
                                  Community Reaction Score (30% Weight)
                                </span>
                                <span className="text-sm font-extrabold text-amber-800 font-mono">
                                  {Math.max(
                                    detail.reactions?.[0]?.reactionCount ?? 0,
                                    detail.projectSubmission.reactions?.[0]?.reactionCount ?? 0
                                  )}{' '}
                                  Reactions
                                </span>
                                <span className="text-[10px] text-amber-700 block mt-0.5">
                                  ⚡ Automatically updated whenever users react on the @NilePixelTech post
                                </span>
                              </div>
                              <span className="badge-amber text-[10px] font-bold py-1 px-2 shrink-0">
                                Live Synced
                              </span>
                            </div>
                          )}

                          {/* Action Buttons for Submission */}
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                            {detail.projectSubmission.status !== 'published' && (
                              <button
                                onClick={() =>
                                  publishMutation.mutate(detail.projectSubmission!.id)
                                }
                                disabled={publishMutation.isPending}
                                className="btn-base py-1.5 px-3 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center gap-1.5"
                              >
                                <Send size={12} />
                                {publishMutation.isPending
                                  ? 'Publishing…'
                                  : 'Publish Showcase to @NilePixelTech'}
                              </button>
                            )}
                            <button
                              onClick={() =>
                                verifyMutation.mutate({
                                  id: detail.id,
                                  status: 'rejected',
                                })
                              }
                              disabled={verifyMutation.isPending}
                              className="btn-base py-1.5 px-3 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 flex items-center gap-1"
                            >
                              <X size={13} />
                              Reject
                            </button>
                            {detail.projectSubmission.status !== 'verified' &&
                              detail.projectSubmission.status !== 'published' && (
                                <button
                                  onClick={() =>
                                    verifyMutation.mutate({
                                      id: detail.id,
                                      status: 'verified',
                                    })
                                  }
                                  disabled={verifyMutation.isPending}
                                  className="btn-base py-1.5 px-3 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                                >
                                  <Check size={13} />
                                  Verify
                                </button>
                              )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          <p className="mb-2">No showcase project submitted for this contestant yet.</p>
                          <button
                            onClick={() => {
                              setSubTitle('');
                              setSubUrl('');
                              setSubDesc('');
                              setIsEditingSubmission(true);
                            }}
                            className="btn-base btn-secondary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Plus size={12} /> Create Project Submission
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Referrals Made Breakdown */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                        Invited Members ({detail.referralsMade?.length ?? 0})
                      </h3>
                      {!detail.referralsMade || detail.referralsMade.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                          No members have joined through this participant's link yet.
                        </p>
                      ) : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500">
                                  Referred Member
                                </th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500">
                                  Telegram ID
                                </th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-500">
                                  Joined At
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {detail.referralsMade.map((ref) => (
                                <tr key={ref.id}>
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    {ref.referred.username
                                      ? `@${ref.referred.username}`
                                      : ref.referred.firstName}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-slate-500">
                                    {ref.referred.telegramId}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-500 font-mono">
                                    {format(new Date(ref.createdAt), 'MMM d, HH:mm')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setSelectedId(null)}
                  className="btn-base btn-secondary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
