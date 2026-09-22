import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX
} from 'lucide-react';
import { User } from '../../types';

interface AdminUserManagementProps {
  token: string | null;
  currentUserId?: string;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ token, currentUserId }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to load users: HTTP ${res.status}`);
      const json: User[] = await res.json();
      setUsers(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleToggleRole = async (targetUser: User) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change role of "${targetUser.email}" to "${newRole}"?`)) {
      return;
    }

    try {
      setActionInProgress(targetUser.id);
      setNotice(null);
      const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to change role');
      setNotice(`User ${targetUser.email} role updated to ${newRole}`);
      setTimeout(() => setNotice(null), 4000);
      fetchUsers();
    } catch (err) {
      alert(`Role change failed: ${(err as Error).message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    const newStatus = targetUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change status of "${targetUser.email}" to "${newStatus}"?`)) {
      return;
    }

    try {
      setActionInProgress(targetUser.id);
      setNotice(null);
      const res = await fetch(`/api/admin/users/${targetUser.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update status');
      setNotice(`User ${targetUser.email} status updated to ${newStatus}`);
      setTimeout(() => setNotice(null), 4000);
      fetchUsers();
    } catch (err) {
      alert(`Status update failed: ${(err as Error).message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading user directory & authentication records...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Header & Search */}
      <div className="p-5 bg-[#0d1424] border border-[#1d2b42] rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182338] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>User Directory & Role-Based Access Control</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Manage platform operator credentials and access states. All modifications are permanently recorded in the Admin Audit Trail.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search user or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#090e18] border border-[#21304a] rounded pl-8 pr-2.5 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none w-48 sm:w-56"
              />
            </div>
            <button
              onClick={fetchUsers}
              className="p-1.5 rounded bg-[#090e18] border border-[#21304a] text-slate-400 hover:text-cyan-300 transition-colors"
              title="Refresh users"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[11px] flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#182338] text-[11px] text-slate-400 font-bold uppercase">
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Registered</th>
                <th className="py-2.5 px-3">Last Login</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141e30] text-[11px]">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                        {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.name || '--'}</span>
                      {isSelf && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[9px] border border-cyan-800">
                          YOU
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'admin'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700/50'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-rose-950 text-rose-300 border border-rose-700/50'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={actionInProgress === u.id || isSelf}
                          title={isSelf ? 'Cannot modify your own role' : 'Toggle role between user and admin'}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                            u.role === 'admin'
                              ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                              : 'bg-amber-950/60 hover:bg-amber-900 border-amber-700/50 text-amber-300'
                          } disabled:opacity-40`}
                        >
                          {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={actionInProgress === u.id || isSelf}
                          title={isSelf ? 'Cannot disable your own account' : 'Toggle account active status'}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                            u.status === 'ACTIVE'
                              ? 'bg-rose-950/60 hover:bg-rose-900 border-rose-700/50 text-rose-300'
                              : 'bg-emerald-950/60 hover:bg-emerald-900 border-emerald-700/50 text-emerald-300'
                          } disabled:opacity-40`}
                        >
                          {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                    No users found matching query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
