import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Table2,
  Wallet,
  Dumbbell,
  Target,
  Sparkles,
  CalendarDays,
  Settings,
  Search,
  ShieldCheck,
  Globe2,
  X,
  BookOpen,
  MessageCircle,
  Mail,
  Music2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { ModuleType, TaskListType } from '../../types';

interface NavItem {
  id: ModuleType;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'tables', label: 'Tables', icon: Table2 },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'goals', label: 'Goals & Habits', icon: Target },
  { id: 'trackers', label: 'Custom Trackers', icon: Sparkles },
  { id: 'tasks', label: 'Tasks & Calendar', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const TASK_LISTS: { name: TaskListType; dotColor: string }[] = [
  { name: 'Inbox', dotColor: 'bg-purple-500' },
  { name: 'Work', dotColor: 'bg-blue-500' },
  { name: 'Study', dotColor: 'bg-amber-500' },
  { name: 'Health', dotColor: 'bg-rose-500' },
  { name: 'Holiday trip', dotColor: 'bg-pink-500' },
];

export const Sidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    isSidebarOpen,
    setSidebarOpen,
    setSearchOpen,
    tasks,
    tables,
    setSelectedTableId,
    userProfile,
    setProfileOpen,
    openMusicWidget,
  } = useApp();
  const { isAdmin } = useAuth();
  const { isConnected } = useIntegrations();

  const handleNavClick = (mod: ModuleType) => {
    setActiveModule(mod);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleTableClick = (tableId: string) => {
    setSelectedTableId(tableId);
    setActiveModule('tables');
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
                Cosmos OS
              </div>
              <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] truncate max-w-[130px]">
                {userProfile.workspaceName}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-md p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
          {/* Main Module Nav */}
          <nav className="space-y-0.5" aria-label="Main Navigation">
            {[...NAV_ITEMS, ...(isAdmin ? [{ id: 'admin' as ModuleType, label: 'Admin', icon: ShieldCheck }] : [])].map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#3D5240] text-white dark:bg-[#303B2E] dark:text-[#A8BDA1]'
                      : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white dark:text-[#A8BDA1]' : 'text-[#8A8E85]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick External Channels (WhatsApp & Gmail) */}
          <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <div className="px-3 pb-1.5 text-[11px] font-bold tracking-wider text-[#8A8E85] uppercase">
              Channels
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  handleNavClick('whatsapp');
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
              >
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Web</span>
              </button>

              <button
                onClick={() => {
                  handleNavClick('mail');
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                  <span>Gmail</span>
                </div>
                <span className="text-[10px] font-semibold text-[#8A8E85]">{isConnected('gmail') ? 'Connected' : 'Not connected'}</span>
              </button>

              <button
                onClick={() => {
                  openMusicWidget();
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
              >
                <div className="flex items-center gap-2.5">
                  <Music2 className="h-4 w-4 text-[#FA243C]" />
                  <span>Apple Music</span>
                </div>
                <span className="text-[10px] font-semibold text-[#8A8E85]">Player</span>
              </button>
            </div>
          </div>

          {/* Task Lists Section */}
          <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <div className="flex items-center justify-between px-3 pb-1.5 text-[11px] font-bold tracking-wider text-[#8A8E85] uppercase">
              <span>Task Lists</span>
              <span className="font-medium text-[10px]">
                {tasks.filter((t) => t.status !== 'completed').length} Active
              </span>
            </div>
            <div className="space-y-0.5">
              {TASK_LISTS.map((list) => {
                const count = tasks.filter((t) => t.list === list.name && t.status !== 'completed').length;
                return (
                  <button
                    key={list.name}
                    onClick={() => handleNavClick('tasks')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${list.dotColor}`} />
                      <span>{list.name}</span>
                    </div>
                    <span className="text-[11px] text-[#8A8E85] font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tables Section */}
          <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <div className="px-3 pb-1.5 text-[11px] font-bold tracking-wider text-[#8A8E85] uppercase">
              Tables
            </div>
            <div className="space-y-0.5">
              {tables.map((tbl) => (
                <button
                  key={tbl.id}
                  onClick={() => handleTableClick(tbl.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] truncate text-left"
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#8A8E85]" />
                  <span className="truncate">{tbl.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: Local-First Storage badge */}
        <div className="border-t border-[#DFE1D9] dark:border-[#383D35] p-3">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
            <div className="flex items-center gap-1.5 text-[#477653] dark:text-[#91B594] font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Local-First Storage</span>
            </div>
            <span className="font-mono text-[#8A8E85]">v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
