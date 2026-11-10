import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { District } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Modal, Input } from '@/components/ui';
import { Plus, Edit2, Power } from 'lucide-react';

export function AdminDistrictsPage() {
  const { toast } = useToast();
  const [districts, setDistricts] = useState<District[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editDistrict, setEditDistrict] = useState<District | null>(null);
  const [name, setName] = useState('');
  const [stateName, setStateName] = useState('');
  const [code, setCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadDistricts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('districts')
        .select('*')
        .order('state', { ascending: true })
        .order('name', { ascending: true });
      if (fetchErr) throw fetchErr;
      setDistricts((data || []) as District[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load districts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDistricts();
  }, [loadDistricts]);

  const openModal = (d?: District) => {
    setEditDistrict(d || null);
    setName(d?.name || '');
    setStateName(d?.state || '');
    setCode(d?.code || '');
    setIsActive(d?.is_active ?? true);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_district', {
        p_id: editDistrict?.id || null,
        p_name: name,
        p_state: stateName,
        p_code: code,
        p_is_active: isActive,
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: editDistrict ? 'District Updated' : 'District Added' });
      setModalOpen(false);
      await loadDistricts();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Save Failed', message: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (d: District) => {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_district', {
        p_id: d.id,
        p_name: d.name,
        p_state: d.state,
        p_code: d.code,
        p_is_active: !(d.is_active ?? true),
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: d.is_active === false ? 'District Activated' : 'District Deactivated' });
      await loadDistricts();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Action Failed', message: err instanceof Error ? err.message : undefined });
    }
  };

  const uniqueStates = Array.from(new Set(districts.map((d) => d.state))).sort();
  const q = searchQuery.trim().toLowerCase();
  const filtered = districts.filter(
    (d) =>
      (!stateFilter || d.state === stateFilter) &&
      (!q ||
        d.name.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q) ||
        (d.code || '').toLowerCase().includes(q))
  );

  const columns: ColumnDef<District>[] = [
    { key: 'name', header: 'District Name', render: (d) => <span className="font-bold text-slate-900">{d.name}</span> },
    { key: 'state', header: 'State', render: (d) => <span>{d.state}</span> },
    { key: 'code', header: 'Code', render: (d) => <span className="font-mono text-xs">{d.code || '—'}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (d) => (
        <Badge variant={d.is_active === false ? 'danger' : 'success'} size="sm">
          {d.is_active === false ? 'Inactive' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openModal(d)} leftIcon={<Edit2 className="w-3 h-3" />}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleActive(d)} leftIcon={<Power className="w-3 h-3" />}>
            {d.is_active === false ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Districts & States Coverage"
      breadcrumbs={[{ label: 'Districts' }]}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search district, state, code..."
      headerActions={
        <Button variant="primary" size="sm" onClick={() => openModal()} leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Add District
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <select
          aria-label="Filter by state"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">All States ({uniqueStates.length})</option>
          {uniqueStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="text-xs text-slate-500 tabular-nums">
          Total: <strong className="text-slate-900">{filtered.length}</strong> districts
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        error={error}
        onRetry={loadDistricts}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editDistrict ? 'Edit District' : 'Add District'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="District Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Mysuru" />
          <Input label="State" value={stateName} onChange={(e) => setStateName(e.target.value)} required placeholder="e.g. Karnataka" />
          <Input label="District Code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. KA-MYS" />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <span>Active for registrations and group matching</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>Save District</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
