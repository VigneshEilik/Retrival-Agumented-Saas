'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Users, UserPlus, ShieldCheck, Mail, Trash2, CheckCircle2 } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'ACTIVE' | 'INVITED';
  joinedAt: string;
}

export default function TeamManagementPage() {
  const [members, setMembers] = useState<Member[]>([
    { id: 'm-1', name: 'Vignesh K.', email: 'vignesh@acme.com', role: 'OWNER', status: 'ACTIVE', joinedAt: '2026-08-15' },
    { id: 'm-2', name: 'Arun Kumar', email: 'arun@acme.com', role: 'ADMIN', status: 'ACTIVE', joinedAt: '2026-08-20' },
    { id: 'm-3', name: 'Priya Sharma', email: 'priya@acme.com', role: 'MEMBER', status: 'ACTIVE', joinedAt: '2026-08-28' },
    { id: 'm-4', name: 'Rahul Verma', email: 'rahul@acme.com', role: 'VIEWER', status: 'INVITED', joinedAt: '2026-09-01' },
  ]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMember: Member = {
      id: `m-${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'INVITED',
      joinedAt: new Date().toISOString().split('T')[0],
    };

    setMembers((prev) => [...prev, newMember]);
    setInviteEmail('');
    setShowInviteModal(false);
  };

  const handleRoleChange = (memberId: string, newRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  return (
    <SaaSLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <Users className="w-4 h-4" /> Team & RBAC Management
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Workspace Members & Roles</h1>
            <p className="text-gray-400 text-sm mt-1">Manage team access permissions with server-enforced role hierarchy.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              <UserPlus className="w-4 h-4" /> Invite Team Member
            </button>
          </div>
        </div>

        {/* Members Table */}
        <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Member</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Joined Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-4 font-medium text-white">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.email}</div>
                  </td>
                  <td className="py-4 px-4">
                    <select
                      value={m.role}
                      disabled={m.role === 'OWNER'}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                      className="bg-gray-900 border border-gray-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono"
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    {m.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Mail className="w-3 h-3" /> Invited
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-gray-400 font-mono text-xs">{m.joinedAt}</td>
                  <td className="py-4 px-4 text-right">
                    {m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        title="Remove Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="glass-panel p-6 rounded-xl border border-gray-800 max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-white">Invite Team Member</h3>
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@acme.com"
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="ADMIN">ADMIN (Full management access)</option>
                    <option value="MEMBER">MEMBER (Upload & Chat access)</option>
                    <option value="VIEWER">VIEWER (Read-only access)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 rounded-lg border border-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium shadow-lg"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </SaaSLayout>
  );
}
