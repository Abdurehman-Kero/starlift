import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { systemApi } from '../services/api';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Trophy,
  Settings,
  LogOut,
  Menu,
  X,
  History,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Radio,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/participants', label: 'Participants', icon: Users },
  { path: '/referrals', label: 'Referrals', icon: GitBranch },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/activity', label: 'Activity Log', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    dbConnected: boolean;
    botRunning: boolean;
    warning: string | null;
  }>({
    dbConnected: false,
    botRunning: false,
    warning: null,
  });

  useEffect(() => {
    systemApi
      .status()
      .then((res) => {
        const data = res.data?.data;
        if (data) {
          const dbConnected = Boolean(data.database?.connected);
          const botRunning = Boolean(data.bot?.running);
          let warning: string | null = null;

          if (!dbConnected) {
            warning = 'Database Disconnected';
          } else if (!botRunning) {
            warning = 'Bot Paused';
          } else if (data.envIssues?.length > 0) {
            warning = 'Config Notice';
          }

          setSystemStatus({
            dbConnected,
            botRunning,
            warning,
          });
        }
      })
      .catch(() => {
        setSystemStatus({
          dbConnected: false,
          botRunning: false,
          warning: 'Backend Offline',
        });
      });
  }, []);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const active = navItems.find((item) => item.path === location.pathname);
    return active ? active.label : 'Dashboard';
  };

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white">
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
            ✦
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none truncate">
              NilePixel StarLift
            </h1>
            <p className="text-[11px] font-medium text-slate-500 mt-1 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
              Nov 15 – Nov 30 Challenge
            </p>
          </div>
        </div>

        {/* Dedicated Close Button on Mobile Drawer */}
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 shrink-0 ml-2"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Management
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                size={17}
                className={`shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Target Channel Info */}
      <div className="p-3 mx-3 mb-2 rounded-lg bg-slate-50 border border-slate-200/80 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <Radio size={12} className="text-blue-600 animate-pulse shrink-0" />
            Active Channel
          </span>
          <a
            href="https://t.me/NilePixelTech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5 font-semibold shrink-0"
          >
            Open <ExternalLink size={10} />
          </a>
        </div>
        <p className="text-xs font-semibold text-slate-800 mt-1 font-mono truncate">
          @NilePixelTech
        </p>
      </div>

      {/* User Profile & Sign Out */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 border border-slate-200/60 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {admin?.email ? admin.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {admin?.email || 'Admin'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-none">Super Administrator</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold text-slate-600 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-100"
        >
          <LogOut size={14} className="shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-slate-50/60 overflow-hidden">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-slate-200">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-white shadow-2xl z-50 flex flex-col h-full animate-in slide-in-from-left duration-200 border-r border-slate-200">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Fully Responsive Top Navbar */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 shrink-0">
          {/* Left: Mobile Menu Toggle & Brand / Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden text-slate-700 p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
            >
              <Menu size={19} />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 min-w-0">
              <span className="hidden sm:inline font-medium text-slate-400">NilePixel</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-bold text-slate-900 text-sm sm:text-xs truncate">
                {getPageTitle()}
              </span>
            </div>
          </div>

          {/* Right: Live Status Pills & Challenge Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* System Status Indicators */}
            {systemStatus.warning ? (
              <span className="badge-amber text-[10px] sm:text-xs py-0.5 px-2 font-medium truncate max-w-[130px] sm:max-w-none">
                <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                <span className="truncate">{systemStatus.warning}</span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="badge-emerald text-[10px] sm:text-xs py-0.5 px-2">
                  <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Database</span> Live
                </span>
                <span className="badge-blue text-[10px] sm:text-xs py-0.5 px-2 hidden sm:inline-flex">
                  <Radio size={11} className="text-blue-600 shrink-0" />
                  Bot Polling
                </span>
              </div>
            )}

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* Challenge Dates Pill */}
            <span className="badge-slate font-mono text-[10px] sm:text-[11px] py-0.5 px-2 shrink-0">
              <span className="hidden md:inline">Nov 15 – 30, 2026</span>
              <span className="md:hidden">Nov 15–30</span>
            </span>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};
