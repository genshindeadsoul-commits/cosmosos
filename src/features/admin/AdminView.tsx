import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface Overview {
  total_users: number;
  new_users_7d: number;
  integrations_by_status: Record<string, number>;
  integrations_with_errors: number;
}

/**
 * Aggregate counts only. The database function admin_overview() re-checks admin status itself,
 * so hiding this screen is a convenience, not the security boundary. No private content is shown.
 */
export const AdminView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc('admin_overview').then(({ data, error }) => {
      if (error) setError(error.code === '42501' ? 'You are not authorized to view this page.' : error.message);
      else setData(data as Overview);
    });
  }, []);

  if (!isAdmin && !data) return <p role="alert" className="text-sm">You are not authorized to view this page.</p>;
  if (error) return <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{error}</p>;
  if (!data) return <p role="status" className="text-sm text-[#6B7067]">Loading…</p>;

  const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4">
      <div className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-bold">Admin overview</h1>
      <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
        Counts only. Admins cannot read users' notes, mail, messages, health, music, or financial records from this app.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accounts" value={data.total_users} />
        <Stat label="New in 7 days" value={data.new_users_7d} />
        <Stat label="Integrations with errors" value={data.integrations_with_errors} />
        <Stat label="Connectors by status" value={<span className="text-sm font-medium">{Object.entries(data.integrations_by_status).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'}</span>} />
      </div>
    </div>
  );
};
