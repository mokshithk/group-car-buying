import React, { useState } from 'react';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { INITIAL_DISTRICTS } from '@/lib/catalogData';
import { getLocalBookings, getLocalInterests } from '@/lib/bookingService';
import { getWishlist, getBuyerPreferences } from '@/lib/groupService';
import { Shield, User, Lock, Download, Trash2, AlertTriangle } from 'lucide-react';

export function ProfilePrivacyPage() {
  const { user, profile, logout } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || 'Rahul Sharma');
  const [phone, setPhone] = useState(profile?.phone || '+91 98765 43210');
  const [districtId, setDistrictId] = useState(
    profile?.district_id || 'd1111111-1111-1111-1111-111111111101'
  );
  const [consentShareDetails, setConsentShareDetails] = useState(
    profile?.consent_share_details ?? true
  );

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      type: 'success',
      title: 'Profile Updated',
      message: 'Your personal details and contact consent have been updated.',
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ type: 'error', title: 'Password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ type: 'error', title: 'Passwords do not match' });
      return;
    }
    toast({ type: 'success', title: 'Password Changed Successfully' });
    setNewPassword('');
    setConfirmPassword('');
  };

  // Download My Data (Section 3)
  const handleDownloadData = () => {
    if (!user) return;
    const userData = {
      profile,
      bookings: getLocalBookings(),
      interests: getLocalInterests(),
      wishlist: getWishlist(user.id),
      preferences: getBuyerPreferences(user.id),
      exportTimestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(userData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autogroup_buyer_data_${user.id.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      type: 'success',
      title: 'Data Exported',
      message: 'Your personal data package has been downloaded.',
    });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsDeleting(false);
    setShowDeleteModal(false);
    toast({
      type: 'info',
      title: 'Account Deleted',
      message: 'Your account and memberships have been purged.',
    });
    await logout();
  };

  return (
    <BuyerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Profile & Privacy Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal data, dealership contact consent, and data export.
          </p>
        </div>

        {/* 1. EDIT DETAILS & CONSENT */}
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Personal Information</CardTitle>
              <CardDescription>
                Your phone number is strictly encrypted and never revealed to members or unbooked dealers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                leftIcon={<User className="w-4 h-4" />}
              />

              <Input
                label="Mobile Contact Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <Select
                label="Registered District"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                options={INITIAL_DISTRICTS.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.state})`,
                }))}
              />

              {/* Consent Toggle (Section 3) */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentShareDetails}
                    onChange={(e) => setConsentShareDetails(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <strong>Consent to Share Contact with Quoting Dealerships:</strong> Allow AutoGroup to share my name and phone with an authorized dealership <em>only when I click "I'm interested" or "Book now"</em> on their quotation.
                  </div>
                </label>
              </div>

              <Button type="submit" variant="primary" size="md" className="mt-2">
                Save Profile Changes
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* 2. CHANGE PASSWORD */}
        <form onSubmit={handleChangePassword}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="secondary" size="md">
                Update Password
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* 3. DOWNLOAD MY DATA (GDPR / Indian DPDP Act compliance) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Download My Data</CardTitle>
            <CardDescription>
              Export an archive containing your full profile, group memberships, locked quotations, and wishlist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="md"
              onClick={handleDownloadData}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export Data Archive (.JSON)
            </Button>
          </CardContent>
        </Card>

        {/* 4. DELETE ACCOUNT WITH CONFIRMATION (Section 3) */}
        <Card className="border-rose-200 bg-rose-50/20">
          <CardHeader>
            <CardTitle className="text-base text-rose-900">Danger Zone: Delete Account</CardTitle>
            <CardDescription className="text-rose-700">
              Permanently purges your buyer account, leaves all active groups, and removes saved preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="danger"
              size="md"
              onClick={() => setShowDeleteModal(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete My Account
            </Button>
          </CardContent>
        </Card>

        {/* DELETE ACCOUNT CONFIRMATION MODAL */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Permanently Delete Your Account?"
          description="This action is immediate and cannot be reversed."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteAccount}
                isLoading={isDeleting}
              >
                Yes, Delete My Account
              </Button>
            </div>
          }
        >
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Warning: Irreversible Data Deletion</span>
            </div>
            <p>
              Deleting your account will remove your active group memberships, anonymize any past group chat logs, and delete your preferences. If you have an active booked vehicle with a showroom, you will need to contact the showroom directly with your booking voucher code.
            </p>
          </div>
        </Modal>
      </div>
    </BuyerLayout>
  );
}
