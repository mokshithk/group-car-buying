import React, { useState, useEffect, useCallback } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Input, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/formatters';
import { UserCheck, Plus, Trash2, Mail, AlertCircle } from 'lucide-react';

interface StaffRow {
  id: string;
  dealership_id: string;
  user_id: string;
  role: 'owner' | 'staff';
  created_at: string;
  full_name: string;
  email: string;
  phone?: string;
  account_status?: string;
}

export function StaffManagementPage() {
  const { user, dealership, dealerUserRole } = useAuth();
  const { toast } = useToast();
  const isOwner = dealerUserRole === 'owner';

  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!dealership?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_dealer_staff');
      if (!rpcErr && Array.isArray(rpcData)) {
        setStaffList(rpcData as StaffRow[]);
        return;
      }

      if (rpcErr && !rpcErr.message.includes('get_dealer_staff')) {
        throw rpcErr;
      }

      // Pre-008 fallback for own user record
      const { data: duRows, error: duErr } = await supabase
        .from('dealer_users')
        .select('id, dealership_id, user_id, role, created_at')
        .eq('dealership_id', dealership.id);
      if (duErr) throw duErr;

      setStaffList(
        (duRows || []).map((row) => ({
          id: row.id,
          dealership_id: row.dealership_id,
          user_id: row.user_id,
          role: row.role as 'owner' | 'staff',
          created_at: row.created_at,
          full_name: row.user_id === user?.id ? 'You' : 'Showroom Team Member',
          email: row.user_id === user?.id ? user?.email || '' : row.user_id,
        }))
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load dealership staff.');
    } finally {
      setIsLoading(false);
    }
  }, [dealership?.id, user]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('manage_dealer_staff', {
        p_action: 'ADD',
        p_email: newStaffEmail.trim(),
      });

      if (error) {
        toast({
          type: 'error',
          title: 'Could Not Add Staff',
          message: error.message,
        });
        return;
      }

      toast({
        type: 'success',
        title: 'Staff Member Linked',
        message: `${newStaffEmail.trim()} now has showroom sales staff permissions.`,
      });
      setShowAddModal(false);
      setNewStaffEmail('');
      await loadStaff();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStaff = async (staffRow: StaffRow) => {
    if (!isOwner) return;

    const { error } = await supabase.rpc('manage_dealer_staff', {
      p_action: 'REMOVE',
      p_dealer_user_id: staffRow.id,
    });

    if (error) {
      toast({
        type: 'error',
        title: 'Could Not Remove Staff',
        message: error.message,
      });
      return;
    }

    toast({
      type: 'info',
      title: 'Staff Access Revoked',
      message: `Access for ${staffRow.full_name || staffRow.email} removed.`,
    });
    await loadStaff();
  };

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-brand-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Staff & User Permissions
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage authorized sales executives and showroom owners linked to {dealership?.name || 'your dealership'}.
            </p>
          </div>

          {isOwner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Link Staff Account
            </Button>
          )}
        </div>

        {!isOwner && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Only the dealership owner can add or remove showroom staff permissions.</span>
          </div>
        )}

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base text-slate-900">
              Showroom Personnel ({staffList.length})
            </CardTitle>
            <CardDescription>
              Owners hold full commercial authority; staff can submit and modify on-road quotations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading showroom personnel...</div>
            ) : staffList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No linked personnel records found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {staffList.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                        {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                          <span>{member.full_name || 'Team Member'}</span>
                          {member.role === 'owner' ? (
                            <Badge variant="brand" size="sm">Showroom Owner</Badge>
                          ) : (
                            <Badge variant="default" size="sm">Sales Staff</Badge>
                          )}
                          {member.user_id === user?.id && (
                            <Badge variant="success" size="sm">You</Badge>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {member.email} · Added {formatDate(member.created_at)}
                        </div>
                      </div>
                    </div>

                    {isOwner && member.role !== 'owner' && member.user_id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStaff(member)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove staff member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ADD STAFF MODAL */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Link Registered User as Sales Staff"
          description="Enter the email address of a registered AutoGroup user to grant sales staff access."
        >
          <form onSubmit={handleAddStaff} className="space-y-4 pt-2 text-xs">
            <Input
              label="Registered User Email"
              type="email"
              placeholder="colleague@apexmotors.com"
              required
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              helperText="Your colleague must have an existing registered user account on AutoGroup."
            />

            <Button type="submit" variant="primary" size="md" className="w-full mt-2" isLoading={isSubmitting}>
              Grant Sales Staff Access
            </Button>
          </form>
        </Modal>
      </div>
    </DealerLayout>
  );
}
