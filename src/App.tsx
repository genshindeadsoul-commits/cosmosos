import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGate } from './components/auth/AuthGate';
import { IntegrationsProvider } from './context/IntegrationsContext';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { QuickCaptureModal } from './components/common/QuickCaptureModal';
import { FloatingMusicPlayer } from './components/music/FloatingMusicPlayer';
import { ProfileModal } from './components/profile/ProfileModal';
import { MailView } from './features/mail/MailView';
import { WhatsAppView } from './features/whatsapp/WhatsAppView';
import { AppleMusicWidget } from './components/music/AppleMusicWidget';
import { PrefsProvider } from './context/PrefsContext';

import { DashboardView } from './features/dashboard/DashboardView';
import { NotesView } from './features/notes/NotesView';
import { TablesView } from './features/tables/TablesView';
import { ExpensesView } from './features/expenses/ExpensesView';
import { FitnessView } from './features/fitness/FitnessView';
import { GoalsHabitsView } from './features/goals/GoalsHabitsView';
import { CustomTrackersView } from './features/trackers/CustomTrackersView';
import { TasksSchedulingView } from './features/tasks/TasksSchedulingView';
import { SettingsView } from './features/settings/SettingsView';
import { AdminView } from './features/admin/AdminView';

const MainContent: React.FC = () => {
  const { activeModule, toasts, loadState, loadError, retryLoad, signOutUser } = useApp();
  const { isAdmin } = useAuth();

  // Private modules mount only after this user's data has loaded; nothing from a previous account can render.
  if (loadState !== 'ready') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F5F5F0] dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]">
        {loadState === 'loading' ? (
          <p role="status" className="text-sm text-[#6B7067] dark:text-[#A6AB9F]">Loading your workspace…</p>
        ) : (
          <div role="alert" className="max-w-sm rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-6 text-sm">
            <p className="font-semibold">Couldn’t load your workspace</p>
            <p className="mt-1 text-[#6B7067] dark:text-[#A6AB9F]">{loadError}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={retryLoad} className="rounded-md bg-[#526B55] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#405541]">Retry</button>
              <button onClick={() => void signOutUser()} className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold">Sign out</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderModuleView = () => {
    switch (activeModule) {
      case 'notes': return <NotesView />;
      case 'tables': return <TablesView />;
      case 'expenses': return <ExpensesView />;
      case 'fitness': return <FitnessView />;
      case 'goals': return <GoalsHabitsView />;
      case 'trackers': return <CustomTrackersView />;
      case 'tasks': return <TasksSchedulingView />;
      case 'mail': return <MailView />;
      case 'whatsapp': return <WhatsAppView />;
      case 'settings': return <SettingsView />;
      case 'admin': return isAdmin ? <AdminView /> : <DashboardView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F5F0] dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{renderModuleView()}</main>
      </div>

      <GlobalSearchModal />
      <QuickCaptureModal />
      <FloatingMusicPlayer />
      <ProfileModal />
      <AppleMusicWidget />

      <div className="fixed bottom-5 left-4 right-4 sm:right-auto sm:left-5 z-50 flex flex-col gap-2 pointer-events-none sm:max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all border ${
              toast.type === 'success' ? 'bg-[#3D5240] text-white border-[#526B55]'
              : toast.type === 'error' ? 'bg-rose-700 text-white border-rose-600'
              : toast.type === 'warning' ? 'bg-amber-600 text-white border-amber-500'
              : 'bg-[#252821] text-white border-[#383D35]'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Keyed by user id: switching accounts unmounts the whole app tree, discarding every in-memory record. */
const Authenticated: React.FC = () => {
  const { user } = useAuth();
  return (
    <AppProvider key={user!.id}>
      <PrefsProvider>
        <IntegrationsProvider>
          <MainContent />
        </IntegrationsProvider>
      </PrefsProvider>
    </AppProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <Authenticated />
      </AuthGate>
    </AuthProvider>
  );
}
