import React, { useState } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  Calendar,
  HardDrive,
  FileSpreadsheet,
  Mail,
  Bell,
  Activity,
  Music,
  Disc,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  MessageCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { SheetsImportPanel, HealthTokenPanel } from './IntegrationPanels';

export const SettingsView: React.FC = () => {
  const {
    exportBackup,
    importBackup,
    resetAllData,
    themePreference,
    setThemePreference,
    effectiveTheme,
    setWhatsAppOpen,
    setGmailOpen,
    toggleMusicPlayer,
    showToast,
  } = useApp();
  const { integrations, connect, disconnect, sync, busy } = useIntegrations();

  const [expandedId, setExpandedId] = useState<string | null>('gcal');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleToggleAccordion = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importBackup(content);
      if (res.success) {
        showToast('Backup restored successfully!', 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteReset = () => {
    resetAllData();
    setShowResetConfirm(false);
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') { showToast('This browser does not support notifications.', 'error'); return; }
    const perm = await Notification.requestPermission();
    showToast(`Notification permission: ${perm}`, perm === 'granted' ? 'success' : 'warning');
  };

  const getProviderIcon = (id: string) => {
    switch (id) {
      case 'gcal':
        return Calendar;
      case 'gdrive':
        return HardDrive;
      case 'gsheets':
        return FileSpreadsheet;
      case 'gmail':
        return Mail;
      case 'reminders':
        return Bell;
      case 'health':
        return Activity;
      case 'spotify':
        return Music;
      case 'apple_music':
        return Disc;
      case 'whatsapp':
        return MessageCircle;
      default:
        return ShieldCheck;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
          Settings & Integrations
        </h1>
        <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
          Manage appearance, cloud accounts, Google Workspace integrations, device reminders, and local data persistence.
        </p>
      </div>

      {/* Appearance & Theme Card */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 sm:p-6 shadow-xs space-y-3">
        <div>
          <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            Appearance & Workspace Theme
          </h2>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Choose your preferred interface theme. Currently active:{' '}
            <span className="font-semibold capitalize text-[#3D5240] dark:text-[#A8BDA1]">
              {effectiveTheme} Mode
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            onClick={() => setThemePreference('light')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              themePreference === 'light'
                ? 'bg-[#3D5240] text-white shadow-xs'
                : 'border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7]'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span>Light</span>
          </button>

          <button
            onClick={() => setThemePreference('dark')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              themePreference === 'dark'
                ? 'bg-[#526B55] text-white shadow-xs'
                : 'border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7]'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span>Dark</span>
          </button>

          <button
            onClick={() => setThemePreference('system')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              themePreference === 'system'
                ? 'bg-[#252821] dark:bg-[#383D35] text-white shadow-xs'
                : 'border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7]'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>System Default</span>
          </button>
        </div>
      </div>

      {/* Data Safety & Local Storage Card matching Screenshot 7 */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            Data Safety & Local Storage
          </h2>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Persistent offline storage with JSON backup and validated restore
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportBackup}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3.5 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Backup</span>
          </button>

          <label className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3.5 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>Restore Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-950/60 bg-rose-50/60 dark:bg-rose-950/20 px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Data</span>
          </button>
        </div>

        {/* Inline Reset Confirmation Dialog (Replaces window.confirm) */}
        {showResetConfirm && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  Confirm Reset to Initial Baseline
                </h4>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  This will reload all default tasks, notes, tables, and trackers. Any newly created records since setup will be reverted to initial seed data.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-rose-200 dark:border-rose-800 px-3 py-1 text-xs font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-100/50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReset}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1 text-xs font-bold text-white shadow-xs"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Integrations Accordion List matching Screenshot 7 */}
      <div className="space-y-3">
        {integrations.map((item) => {
          const Icon = getProviderIcon(item.id);
          const isExpanded = expandedId === item.id;
          const isConnected = item.status === 'connected';

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden transition-colors"
            >
              {/* Header bar */}
              <div
                onClick={() => handleToggleAccordion(item.id)}
                className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-[#F5F5F0]/40 dark:hover:bg-[#292D27]/40"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECEDE7] dark:bg-[#292D27] text-[#526B55] dark:text-[#A8BDA1]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {item.name}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          isConnected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-[#ECEDE7] dark:bg-[#292D27] text-[#8A8E85]'
                        }`}
                      >
                        {isConnected ? 'Connected' : item.status === 'config_required' ? 'Needs setup' : item.status === 'needs_reauthorization' ? 'Needs reauthorization' : 'Not connected'}
                      </span>
                      {item.connectedEmail && (
                        <span className="text-[11px] font-mono text-[#8A8E85] truncate hidden sm:inline">
                          {item.connectedEmail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-[#8A8E85]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#8A8E85]" />
                  )}
                </div>
              </div>

              {/* Description preview row */}
              <div className="px-5 pb-3 -mt-2">
                <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
                  {item.description}
                </p>
                <div className="text-[11px] text-[#8A8E85] pt-1">
                  Last sync: {item.lastSync || 'Never'}
                </div>
              </div>

              {/* Expanded details container */}
              {isExpanded && (
                <div className="border-t border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/30 dark:bg-[#181A17]/30 p-4 sm:p-5 space-y-4">
                  {/* Action box */}
                  <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-3">
                    <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                      {item.name}:
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {item.id === 'gcal' && (
                        <button
                          onClick={() => sync(item.id)}
                          disabled={!isConnected || busy === item.id}
                          className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${busy === item.id ? 'animate-spin' : ''}`} />
                          <span>{busy === item.id ? 'Importing…' : 'Import events now'}</span>
                        </button>
                      )}

                      {item.id === 'reminders' && (
                        <button
                          onClick={enableNotifications}
                          className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] transition-colors"
                        >
                          <Bell className="h-3 w-3" />
                          <span>Enable notifications</span>
                        </button>
                      )}

                      {/* Provider-specific Launchers */}
                      {item.id === 'gmail' && isConnected && (
                        <button
                          onClick={() => setGmailOpen(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                          <span>Open Gmail Inbox</span>
                        </button>
                      )}

                      {item.id === 'whatsapp' && (
                        <button
                          onClick={() => setWhatsAppOpen(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span>Open WhatsApp Dispatch</span>
                        </button>
                      )}

                      {(item.id === 'spotify' || item.id === 'apple_music') && (
                        <button
                          onClick={toggleMusicPlayer}
                          className="flex items-center gap-1.5 rounded-lg bg-[#252821] dark:bg-[#383D35] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                        >
                          <Music className="h-3 w-3" />
                          <span>Open Mini-Player</span>
                        </button>
                      )}
                    </div>

                    {item.connectedEmail && (
                      <p className="text-[11px] font-mono text-[#6B7067] dark:text-[#A6AB9F] pt-1">
                        Primary Account: {item.connectedEmail}
                      </p>
                    )}
                  </div>

                  {item.id === 'gsheets' && isConnected && <SheetsImportPanel />}
                  {item.id === 'health' && <HealthTokenPanel />}

                  {/* Scopes info */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A8E85]">
                      Permissions requested:
                    </span>
                    <ul className="list-disc list-inside text-xs text-[#6B7067] dark:text-[#A6AB9F] space-y-0.5">
                      {item.permissions.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Disconnect and Connector footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#DFE1D9] dark:border-[#383D35] text-xs">
                    {isConnected ? (
                      <button
                        onClick={() => disconnect(item.id)}
                        disabled={busy === item.id}
                        className="font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                      >
                        {busy === item.id ? 'Working…' : 'Disconnect and delete stored access'}
                      </button>
                    ) : ['gcal', 'gmail', 'gsheets', 'spotify'].includes(item.id) ? (
                      <button
                        onClick={() => connect(item.id)}
                        disabled={busy === item.id}
                        className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3 py-1.5 font-bold text-white disabled:opacity-50"
                      >
                        {busy === item.id ? 'Opening…' : item.status === 'needs_reauthorization' || item.status === 'error' ? 'Reconnect' : 'Connect'}
                      </button>
                    ) : (
                      <span className="font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                        {item.id === 'gdrive' ? 'Not available in this build' : item.id === 'health' ? 'Connects when a companion app sends data' : item.id === 'apple_music' ? 'Authorize from the mini-player' : 'Nothing to connect'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
