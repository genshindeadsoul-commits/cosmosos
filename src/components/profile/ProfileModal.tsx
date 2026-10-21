import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Settings,
  ShieldCheck,
  Palette,
  LogOut,
  X,
  Mail,
  Building,
  Key,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ProfileModal: React.FC = () => {
  const {
    isProfileOpen,
    setProfileOpen,
    userProfile,
    updateUserProfile,
    setActiveModule,
    showToast,
    signOutUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'edit'>('overview');
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(userProfile.name);
    setEmail(userProfile.email);
  }, [userProfile]);

  // Handle ESC key and outside clicks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isProfileOpen) {
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileOpen, setProfileOpen]);

  if (!isProfileOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'warning');
      return;
    }
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

    updateUserProfile({
      name: name.trim(),
      avatarInitials: initials,
    });
    setActiveTab('overview');
  };

  const handleNavigate = (module: 'settings') => {
    setActiveModule(module);
    setProfileOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={() => setProfileOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="User Profile & Settings"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-2xl overflow-hidden transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-5 py-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
            <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
              Profile
            </h2>
          </div>
          <button
            onClick={() => setProfileOpen(false)}
            aria-label="Close profile menu"
            className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 rounded-lg py-1.5 transition-colors ${
              activeTab === 'overview'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821]'
            }`}
          >
            Account Details
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 rounded-lg py-1.5 transition-colors ${
              activeTab === 'edit'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821]'
            }`}
          >
            Edit Profile
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {activeTab === 'overview' ? (
            <>
              {/* Profile Card Header */}
              <div className="flex items-center gap-4 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/40 dark:bg-[#181A17]/40 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#3D5240] dark:bg-[#526B55] text-base font-bold text-white shadow-xs">
                  {userProfile.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {userProfile.name}
                  </div>
                  <div className="truncate text-xs text-[#6B7067] dark:text-[#A6AB9F]">
                    {userProfile.email}
                  </div>
                  <div className="text-[11px] font-medium text-[#526B55] dark:text-[#A8BDA1] pt-0.5">
                    {userProfile.workspaceName}
                  </div>
                </div>
              </div>

              {/* Status and security badge */}
              <div className="flex items-center justify-between rounded-lg bg-[#E8EEE6] dark:bg-[#303B2E] px-3 py-2 text-xs text-[#3D5240] dark:text-[#A8BDA1]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-semibold">Signed in with Google</span>
                </div>
                <span className="font-mono text-[11px]">{userProfile.role}</span>
              </div>

              {/* Menu options with real functional routing */}
              <div className="space-y-1 pt-1">
                <button
                  onClick={() => handleNavigate('settings')}
                  className="flex w-full items-center justify-between rounded-lg p-2.5 text-xs text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-[#8A8E85]" />
                    <span className="font-semibold">System Settings & Integrations</span>
                  </div>
                  <span className="text-[10px] text-[#8A8E85]">⌘,</span>
                </button>

                <button
                  onClick={() => handleNavigate('settings')}
                  className="flex w-full items-center justify-between rounded-lg p-2.5 text-xs text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Palette className="h-4 w-4 text-[#8A8E85]" />
                    <span className="font-semibold">Appearance & Theme Preferences</span>
                  </div>
                  <span className="text-[10px] text-[#526B55] dark:text-[#A8BDA1]">In Settings</span>
                </button>

                <button
                  onClick={() => handleNavigate('settings')}
                  className="flex w-full items-center justify-between rounded-lg p-2.5 text-xs text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-[#8A8E85]" />
                    <span className="font-semibold">Connected Provider Accounts</span>
                  </div>
                  <span className="text-[10px] text-[#8A8E85]">Google, Apple, Spotify</span>
                </button>
              </div>

              {/* Sign out */}
              <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
                <button
                  onClick={async () => { setProfileOpen(false); await signOutUser(); }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] py-2 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          ) : (
            /* Edit Profile Tab */
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Full Name
                </label>
                <div className="flex items-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs">
                  <User className="h-3.5 w-3.5 text-[#8A8E85] mr-2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Primary Email
                </label>
                <div className="flex items-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs">
                  <Mail className="h-3.5 w-3.5 text-[#8A8E85] mr-2" />
                  <input
                    type="email"
                    value={email}
                    readOnly
                    aria-readonly="true"
                    title="Email comes from your Google account"

                    className="w-full bg-transparent text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
