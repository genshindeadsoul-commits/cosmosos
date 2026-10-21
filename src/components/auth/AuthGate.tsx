import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#F5F5F0] dark:bg-[#181A17] px-4 text-[#252821] dark:text-[#ECEDE6]">
    <div className="w-full max-w-md rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Cosmos OS</h1>
      {children}
    </div>
  </div>
);

/** Renders children only for a verified session. Private modules never mount before this passes. */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { configured, loading, user, authError, signInWithGoogle, clearAuthError } = useAuth();

  if (!configured) {
    return (
      <Shell>
        <p className="mb-3 text-sm text-[#6B7067] dark:text-[#A6AB9F]">Configuration required</p>
        <p className="text-sm">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>
          and <code>docs/SETUP.md</code>), then restart. Sign-in is disabled until then.
        </p>
      </Shell>
    );
  }
  if (loading) {
    return <Shell><p role="status" className="mt-3 text-sm text-[#6B7067] dark:text-[#A6AB9F]">Restoring session…</p></Shell>;
  }
  if (!user) {
    return (
      <Shell>
        <p className="mb-6 text-sm text-[#6B7067] dark:text-[#A6AB9F]">Sign in to open your workspace.</p>
        {authError && (
          <div role="alert" className="mb-4 rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-300">
            {authError}
          </div>
        )}
        <button
          onClick={() => { clearAuthError(); void signInWithGoogle(); }}
          className="w-full rounded-md bg-[#526B55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#405541] focus:outline-none focus:ring-2 focus:ring-[#526B55] focus:ring-offset-2"
        >
          Continue with Google
        </button>
        <p className="mt-4 text-xs text-[#6B7067] dark:text-[#A6AB9F]">
          Signing in only identifies you. Gmail, Calendar, and other services ask for their own permission later.
        </p>
      </Shell>
    );
  }
  return <>{children}</>;
};
