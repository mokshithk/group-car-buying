import React, { useState } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Input, Select, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { UserCheck, Plus, Trash2, Mail, User } from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  addedAt: string;
}

export function StaffManagementPage() {
  const { toast } = useToast();

  const [staffList, setStaffList] = useState<StaffUser[]>([
    {
      id: 'st-1',
      name: 'Vikram Rao',
      email: 'owner@apexmotors-fake.com',
      role: 'owner',
      addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'st-2',
      name: 'Karan Mehra',
      email: 'sales@apexmotors-fake.com',
      role: 'staff',
      addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'owner' | 'staff'>('staff');

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: StaffUser = {
      id: 'st-' + Math.random().toString(36).substring(2, 9),
      name: newStaffName,
      email: newStaffEmail,
      role: newStaffRole,
      addedAt: new Date().toISOString(),
    };

    setStaffList([...staffList, newUser]);
    toast({
      type: 'success',
      title: 'Staff Member Added',
      message: `${newStaffName} can now sign in with dealer credentials.`,
    });

    setShowAddModal(false);
    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffRole('staff');
  };

  const handleRemoveStaff = (id: string, name: string) => {
    setStaffList(staffList.filter((s) => s.id !== id));
    toast({
      type: 'info',
      title: 'Staff Access Revoked',
      message: `Access for ${name} removed.`,
    });
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
              Grant quotation bidding permissions to authorized showroom managers and sales executives.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Staff Member
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base text-slate-900">Showroom Personnel ({staffList.length})</CardTitle>
            <CardDescription>
              Owners hold full commercial authority; staff can submit and modify on-road quotations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {staffList.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{member.name}</span>
                        {member.role === 'owner' ? (
                          <Badge variant="brand" size="sm">Showroom Owner</Badge>
                        ) : (
                          <Badge variant="default" size="sm">Sales Staff</Badge>
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{member.email}</div>
                    </div>
                  </div>

                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveStaff(member.id, member.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove staff member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ADD STAFF MODAL */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Dealership Personnel"
          description="Send an invitation to join your showroom's AutoGroup account."
        >
          <form onSubmit={handleAddStaff} className="space-y-4 pt-2 text-xs">
            <Input
              label="Staff Member Full Name"
              placeholder="e.g. Ramesh Kumar"
              required
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Official Email Address"
              type="email"
              placeholder="ramesh@apexmotors.com"
              required
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Select
              label="Access Role"
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value as any)}
              options={[
                { value: 'staff', label: 'Sales Staff (Can view groups & submit quotes)' },
                { value: 'owner', label: 'Showroom Owner (Full dealership administration)' },
              ]}
            />

            <Button type="submit" variant="primary" size="md" className="w-full mt-2">
              Add Staff Member
            </Button>
          </form>
        </Modal>
      </div>
    </DealerLayout>
  );
}
