'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Users, UserPlus, ShieldCheck, Mail, Trash2 } from 'lucide-react';

export default function TeamManagementPage() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  const members = [
    { id: 'usr-1', name: 'Vignesh K.', email: 'vignesh@acme.com', role: 'OWNER', status: 'ACTIVE', joined: '2026-01-15' },
    { id: 'usr-2', name: 'Sarah Jenkins', email: 'sarah@acme.com', role: 'ADMIN', status: 'ACTIVE', joined: '2026-03-10' },
    { id: 'usr-3', name: 'David Chen', email: 'david@acme.com', role: 'MEMBER', status: 'ACTIVE', joined: '2026-05-22' },
  ];

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviteModalOpen(false);
    setInviteEmail('');
  };

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Team & Role-Based Access Control</h1>
              <Badge variant="indigo" size="sm">PostgreSQL RLS Enforced</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage organization members and assign server-enforced roles (OWNER, ADMIN, MEMBER, VIEWER).
            </p>
          </div>

          <Button
            onClick={() => setIsInviteModalOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
            variant="primary"
            size="md"
          >
            Invite Team Member
          </Button>
        </div>

        {/* Member Directory Table */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 text-xs font-bold text-white uppercase tracking-wider">
            Active Workspace Members
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
                        {member.name[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{member.name}</div>
                        <div className="text-[10px] text-slate-400">{member.email}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          member.role === 'OWNER' ? 'indigo' : member.role === 'ADMIN' ? 'info' : 'neutral'
                        }
                        size="sm"
                      >
                        {member.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="success" size="sm">ACTIVE</Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{member.joined}</td>
                    <td className="py-3.5 px-4 text-right">
                      {member.role !== 'OWNER' && (
                        <button className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Invite Member Modal */}
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Invite New Team Member"
        >
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <Input
              label="Work Email Address"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Assign Workspace Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="ADMIN">ADMIN — Full access to settings, keys, and members</option>
                <option value="MEMBER">MEMBER — Can upload documents, chat, and build agents</option>
                <option value="VIEWER">VIEWER — Read-only access to knowledge and dashboards</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsInviteModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Send Invitation
              </Button>
            </div>
          </form>
        </Modal>

      </div>
    </SaaSLayout>
  );
}
