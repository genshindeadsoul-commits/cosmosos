import React from 'react';
import {
  Menu,
  Search,
  Music2,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModuleType } from '../../types';

const MODULE_TITLES: Record<ModuleType, string> = {
  dashboard: 'Home',
  notes: 'Notes',
  tables: 'Tables',
  expenses: 'Expenses',
  fitness: 'Fitness',
  goals: 'Goals & Habits',
  trackers: 'Custom Trackers',
  tasks: 'Tasks & Calendar',
  settings: 'Settings',
  mail: 'Mail',
  admin: 'Admin',
};

export const TopBar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    isSidebarOpen,
    setSidebarOpen,
    setSearchOpen,
    openQuickCapture,
    saveStatus,
    saveError,
    retrySave,
    toggleMusicPlayer,
    musicState,
    userProfile,
    setProfileOpen,
  } = useApp();

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/90 dark:bg-[#181A17]/90 px-3 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle navigation drawer"
          className="rounded-md p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] md:hidden focus:outline-none focus:ring-2 focus:ring-[#526B55]"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium tracking-tight text-[#6B7067] dark:text-[#A6AB9F]">
          <span
            onClick={() => setActiveModule('dashboard')}
            className="cursor-pointer font-bold tracking-wider text-[#252821] dark:text-[#ECEDE6] hover:text-[#526B55] dark:hover:text-[#A8BDA1]"
          >
            COSMOS
          </span>
          <span className="text-[#8A8E85] dark:text-[#858B7E]">/</span>
          <span className="font-semibold text-[#252821] dark:text-[#ECEDE6]">
            {MODULE_TITLES[activeModule]}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Global Search Button */}
        <button
          onClick={() => setSearchOpen(true)}
          title="Search Cosmos (⌘K)"
          aria-label="Search records across Cosmos"
          className="flex items-center justify-center rounded-lg p-2 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] hover:text-[#252821] dark:hover:text-[#ECEDE6] transition-colors focus:outline-none focus:ring-2 focus:ring-[#526B55]"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Floating Mini-Player Launcher */}
        <button
          onClick={toggleMusicPlayer}
          title="Toggle Focus Sound & Music Player"
          aria-label="Toggle Focus Sound & Music Player"
          className={`flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
            musicState.isOpen || musicState.isPlaying
              ? 'bg-[#D4F6E3] dark:bg-[#1E3F29] text-[#1E5E3A] dark:text-[#8AE7B0] ring-1 ring-[#73C999]'
              : 'bg-[#E8EEE6] dark:bg-[#292D27] text-[#526B55] dark:text-[#A8BDA1] hover:bg-[#DFE1D9] dark:hover:bg-[#30352D]'
          }`}
        >
          <Music2 className={`h-4 w-4 ${musicState.isPlaying ? 'animate-pulse' : ''}`} />
        </button>

        {/* Add Task Quick Action */}
        <button
          onClick={() => openQuickCapture('task')}
          className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] dark:hover:bg-[#405541] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#526B55]"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Add Task</span>
        </button>

        <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-[11px]">
          {saveStatus === 'error' ? (
            <>
              <span className="font-semibold text-rose-600 dark:text-rose-400" title={saveError ?? undefined}>Not saved</span>
              <button onClick={retrySave} title={saveError ?? 'Retry saving'} className="rounded border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40">Retry</button>
            </>
          ) : (
            <span className="hidden sm:inline text-[#6B7067] dark:text-[#A6AB9F]">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}</span>
          )}
        </span>

        {/* Interactive User Workspace Profile Button */}
        <button
          onClick={() => setProfileOpen(true)}
          title={`${userProfile.name} - ${userProfile.workspaceName} (Click to open Profile & Account)`}
          aria-label="Open User Profile and Settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECEDE7] dark:bg-[#292D27] text-xs font-bold text-[#252821] dark:text-[#ECEDE6] border border-[#DFE1D9] dark:border-[#383D35] hover:ring-2 hover:ring-[#526B55] focus:outline-none focus:ring-2 focus:ring-[#526B55] transition-all cursor-pointer"
        >
          {userProfile.avatarInitials}
        </button>
      </div>
    </header>
  );
};
