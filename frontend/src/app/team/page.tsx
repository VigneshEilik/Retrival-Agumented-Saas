'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { apiJson, hasRealSession } from '@/lib/api';
import { useMe, isAdminRole, Role } from '@/lib/session';
import { Users, UserPlus, Trash2, AlertTriangle, RotateCw, Mail } from 'lucide-react';

interface MemberRow {
  membership_id: string;
  role: Role;
  created_at: string;
  user_id: string;
  email: string;
  full_name: string | null;
}

type AssignableRole = 'ADMIN' | 'MEMBER' | 'VIEWER';
const ASSIGNABLE_ROLES: AssignableRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleBadgeVariant = (role: Role) =>
  role === 'OWNER' ? 'indigo' : role === 'ADMIN' ? 'info' : role === 'MEMBER' ? 'success' : 'neutral';

export default function TeamManagementPage() {
  const { role: myRole, userId: myUserId } = useMe();
  const canManage = isAdminRole(myRole);
  const isOwner = myRole === 'OWNER';

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<AssignableRole>('MEMBER');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<MemberRow | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!hasRealSession()) return;
    setIsLoading(true);
    try {
      const data = await apiJson<{ members: MemberRow[] }>('/api/v1/organizations/members');
      setMembers(data.members || []);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Could not load team members.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openAdd = () => {
    setEmail('');
    setNewRole('MEMBER');
    setEmailError(null);
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    setIsAdding(true);
    setAddError(null);
    try {
      await apiJson('/api/v1/organizations/members', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, role: newRole }),
      });
      setIsAddOpen(false);
      setActionNotice(`${trimmed} was added as ${newRole}.`);
      setActionError(null);
      await loadMembers();
    } catch (err: any) {
      if (err.status === 404) {
        setAddError('No account exists for this email. Ask them to sign up first, then add them here.');
      } else if (err.status === 409) {
        setAddError('This user is already a member of your organization.');
      } else if (err.code === 'QUOTA_EXCEEDED') {
        setAddError(err.message || 'Your plan’s member limit has been reached.');
      } else if (err.status === 403) {
        setAddError('Only owners and admins can add members.');
      } else {
        setAddError(err.message || 'Could not add the member.');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (member: MemberRow, role: AssignableRole) => {
    if (role === member.role) return;
    setRoleUpdating(member.user_id);
    setActionError(null);
    setActionNotice(null);
    try {
      await apiJson(`/api/v1/organizations/members/${member.user_id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMembers((prev) => prev.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)));
      setActionNotice(`${member.email} is now ${role}.`);
    } catch (err: any) {
      setActionError(err.status === 403 ? 'Only the owner can change member roles.' : err.message || 'Could not change the role.');
    } finally {
      setRoleUpdating(null);
    }
  };

  const handleRemove = async () => {
    if (!pendingRemove) return;
    setIsRemoving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await apiJson(`/api/v1/organizations/members/${pendingRemove.user_id}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.user_id !== pendingRemove.user_id));
      setActionNotice(`${pendingRemove.email} was removed from the organization.`);
    } catch (err: any) {
      setActionError(err.status === 403 ? 'Only owners and admins can remove members.' : err.message || 'Could not remove the member.');
    } finally {
      setIsRemoving(false);
      setPendingRemove(null);
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Team & Roles</h1>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Members of your organization and their roles. Owners can change roles; owners and admins can add or remove members.
            </p>
          </div>
          {canManage && (
            <Button onClick={openAdd} leftIcon={<UserPlus className="w-4 h-4" />}>
              Add Member
            </Button>
          )}
        </div>

        {actionError && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionNotice && !actionError && (
          <div role="status" className="p-3 rounded-[8px] border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
            {actionNotice}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading team members..." />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Could not load team members"
            description={loadError}
            action={
              <Button variant="secondary" onClick={loadMembers} leftIcon={<RotateCw className="w-4 h-4" />}>
                Try again
              </Button>
            }
          />
        ) : members.length === 0 ? (
          <EmptyState icon={<Users className="w-8 h-8" />} title="No members found" description="This organization has no members yet." />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {members.map((member) => {
                    const isSelf = member.user_id === myUserId;
                    const isMemberOwner = member.role === 'OWNER';
                    const canEditRole = isOwner && !isSelf && !isMemberOwner;
                    const canRemove = canManage && !isSelf && !isMemberOwner;
                    return (
                      <tr key={member.membership_id} className={isSelf ? 'bg-blue-50/40' : 'hover:bg-slate-50 transition-colors'}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {member.full_name || member.email}
                            {isSelf && <Badge variant="neutral" size="sm">You</Badge>}
                          </div>
                          <div className="text-slate-500 break-all">{member.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          {canEditRole ? (
                            <select
                              aria-label={`Role for ${member.email}`}
                              value={member.role}
                              disabled={roleUpdating === member.user_id}
                              onChange={(e) => handleRoleChange(member, e.target.value as AssignableRole)}
                              className="px-2 py-1 bg-white border border-[#CBD5E1] rounded-[6px] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] disabled:opacity-50"
                            >
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant={roleBadgeVariant(member.role)} size="sm">
                              {member.role}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canRemove ? (
                            <button
                              type="button"
                              onClick={() => setPendingRemove(member)}
                              aria-label={`Remove ${member.email}`}
                              title="Remove member"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Add member */}
        <Modal isOpen={isAddOpen} onClose={() => !isAdding && setIsAddOpen(false)} title="Add a member">
          <form onSubmit={handleAdd} className="space-y-4" noValidate>
            <p className="text-xs text-slate-600">
              The person must already have an account. Email invitations are not available in this release.
            </p>
            {addError && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}
            <Input
              id="member-email"
              label="Email"
              type="email"
              autoFocus
              autoComplete="off"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              error={emailError || undefined}
            />
            <div className="space-y-1.5">
              <label htmlFor="member-role" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Role
              </label>
              <select
                id="member-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AssignableRole)}
                className="w-full px-3.5 py-2 bg-white border border-[#CBD5E1] rounded-[6px] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
              >
                <option value="ADMIN">ADMIN — manage members, keys and knowledge bases</option>
                <option value="MEMBER">MEMBER — create knowledge bases, upload and chat</option>
                <option value="VIEWER">VIEWER — browse and chat; cannot upload or manage</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)} disabled={isAdding}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isAdding} disabled={!email.trim()}>
                Add member
              </Button>
            </div>
          </form>
        </Modal>

        {/* Remove confirmation */}
        <Modal
          isOpen={pendingRemove !== null}
          onClose={() => !isRemoving && setPendingRemove(null)}
          title="Remove member?"
          maxWidth="sm"
        >
          <div className="space-y-4 text-sm">
            <p className="text-slate-700">
              <strong className="text-slate-900">{pendingRemove?.email}</strong> will lose access to this organization immediately.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingRemove(null)} disabled={isRemoving}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={handleRemove} isLoading={isRemoving}>
                Remove
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </SaaSLayout>
  );
}
