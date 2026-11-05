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
  ShieldCheck,
  Globe2,
  X,
  BookOpen,
  Mail,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePrefs } from '../../context/PrefsContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { ModuleType, TASK_LISTS, TASK_LIST_METADATA, DefaultTaskListType } from '../../types';

interface NavItem {
  id: ModuleType;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Home',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { id: 'tasks', label: 'Tasks & Calendar', icon: CalendarDays },
      { id: 'notes', label: 'Notes', icon: FileText },
      { id: 'tables', label: 'Tables', icon: Table2 },
    ],
  },
  {
    section: 'Personal',
    items: [
      { id: 'expenses', label: 'Expenses', icon: Wallet },
      { id: 'fitness', label: 'Fitness', icon: Dumbbell },
      { id: 'goals', label: 'Goals & Habits', icon: Target },
      { id: 'trackers', label: 'Custom Trackers', icon: Sparkles },
    ],
  },
  {
    section: 'Connected Apps',
    items: [
      { id: 'mail', label: 'Gmail', icon: Mail },
    ],
  },
  {
    section: 'Settings',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    isSidebarOpen,
    setSidebarOpen,
    tasks,
    tables,
    setSelectedTableId,
    userProfile,
  } = useApp();
  const { isConnected } = useIntegrations();
  const { prefs, setSelectedTaskList, setActiveTaskWorkspaceView } = usePrefs();

  const handleNavClick = (mod: ModuleType) => {
    setActiveModule(mod);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleTaskListClick = (listName: string) => {
    setSelectedTaskList(listName);
    setActiveTaskWorkspaceView('lists');
    handleNavClick('tasks');
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
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {/* Main Module Nav Grouped */}
          <nav className="space-y-3" aria-label="Main Navigation">
            {NAV_GROUPS.map((group) => (
              <div key={group.section} className="space-y-1">
                <div className="px-2.5 text-[10px] font-bold tracking-wider text-[#8A8E85] uppercase">
                  {group.section}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;
                    const isMail = item.id === 'mail';
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#3D5240] text-white dark:bg-[#303B2E] dark:text-[#A8BDA1]'
                            : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive
                                ? 'text-white dark:text-[#A8BDA1]'
                                : isMail
                                ? 'text-rose-500 dark:text-rose-400'
                                : 'text-[#8A8E85]'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {isMail && (
                          <span
                            className={`text-[10px] font-semibold ${
                              isConnected('gmail')
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-[#8A8E85]'
                            }`}
                          >
                            {isConnected('gmail') ? 'Connected' : 'Not connected'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Task Lists Section */}
          <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <div className="flex items-center justify-between px-2.5 pb-1 text-[10px] font-bold tracking-wider text-[#8A8E85] uppercase">
              <span>Task Queues</span>
              <span className="font-medium text-[10px] text-[#8A8E85]">
                {tasks.filter((t) => t.status !== 'completed').length} Active
              </span>
            </div>
            <div className="space-y-0.5">
              {TASK_LISTS.map((listName) => {
                const meta = TASK_LIST_METADATA[listName];
                const count = tasks.filter((t) => t.list === listName && t.status !== 'completed').length;
                return (
                  <button
                    key={listName}
                    onClick={() => handleTaskListClick(listName)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                      <span>{meta.label}</span>
                    </div>
                    <span className="text-[11px] text-[#8A8E85] font-mono">{count}</span>
                  </button>
                );
              })}
              {prefs.customTaskLists?.filter((l) => !l.archived).map((customList) => {
                const count = tasks.filter((t) => t.list === customList.name && t.status !== 'completed').length;
                return (
                  <button
                    key={customList.id}
                    onClick={() => handleTaskListClick(customList.name)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: customList.color || '#3B82F6' }}
                      />
                      <span>{customList.name}</span>
                    </div>
                    <span className="text-[11px] text-[#8A8E85] font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tables Section */}
          {tables.length > 0 && (
            <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
              <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-[#8A8E85] uppercase">
                Tables
              </div>
              <div className="space-y-0.5">
                {tables.map((tbl) => (
                  <button
                    key={tbl.id}
                    onClick={() => handleTableClick(tbl.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1 text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] truncate text-left"
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#8A8E85]" />
                    <span className="truncate">{tbl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
