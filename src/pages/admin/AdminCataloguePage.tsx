import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { CarIllustration } from '@/components/feature/CarIllustration';
import { Manufacturer, Model, Variant } from '@/types';
import { formatINR } from '@/lib/formatters';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Tabs, Modal, Input, Select } from '@/components/ui';
import { Plus, Edit2, Power } from 'lucide-react';

type CatalogTab = 'manufacturers' | 'models' | 'variants';

const BODY_TYPES: Model['body_type'][] = ['SUV', 'Sedan', 'Hatchback', 'MUV', 'EV'];
const TRANSMISSIONS: Variant['transmission'][] = ['Manual', 'Automatic', 'iMT', 'DCT', 'CVT'];
const FUEL_TYPES: Variant['fuel_type'][] = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

export function AdminCataloguePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<CatalogTab>('models');
  const [searchQuery, setSearchQuery] = useState('');

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Manufacturer modal
  const [mfrModalOpen, setMfrModalOpen] = useState(false);
  const [editMfr, setEditMfr] = useState<Manufacturer | null>(null);
  const [mfrName, setMfrName] = useState('');
  const [mfrLogoUrl, setMfrLogoUrl] = useState('');
  const [mfrActive, setMfrActive] = useState(true);

  // Model modal
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [editModel, setEditModel] = useState<Model | null>(null);
  const [modelMfrId, setModelMfrId] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelBodyType, setModelBodyType] = useState<Model['body_type']>('SUV');
  const [modelFuelTypes, setModelFuelTypes] = useState('Petrol, Diesel');
  const [modelImageUrl, setModelImageUrl] = useState('');
  const [modelPrice, setModelPrice] = useState('800000');
  const [modelActive, setModelActive] = useState(true);

  // Variant modal
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [editVar, setEditVar] = useState<Variant | null>(null);
  const [varModelId, setVarModelId] = useState('');
  const [varName, setVarName] = useState('');
  const [varTrans, setVarTrans] = useState<Variant['transmission']>('Manual');
  const [varFuel, setVarFuel] = useState<Variant['fuel_type']>('Petrol');
  const [varEngineCc, setVarEngineCc] = useState('1197');
  const [varPrice, setVarPrice] = useState('950000');
  const [varFeatures, setVarFeatures] = useState('6 Airbags, ESC, Touchscreen');
  const [varActive, setVarActive] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const loadCatalogue = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [{ data: mData, error: mErr }, { data: modData, error: modErr }, { data: vData, error: vErr }] =
        await Promise.all([
          supabase.from('manufacturers').select('*').order('name', { ascending: true }),
          supabase.from('models').select('*, manufacturer:manufacturers(*)').order('name', { ascending: true }),
          supabase.from('variants').select('*, model:models(*, manufacturer:manufacturers(*))').order('ex_showroom_price', { ascending: true }),
        ]);
      if (mErr) throw mErr;
      if (modErr) throw modErr;
      if (vErr) throw vErr;

      setManufacturers((mData || []) as Manufacturer[]);
      setModels((modData || []) as Model[]);
      setVariants((vData || []) as Variant[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicle catalogue.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  const openMfrModal = (m?: Manufacturer) => {
    setEditMfr(m || null);
    setMfrName(m?.name || '');
    setMfrLogoUrl(m?.logo_url || '');
    setMfrActive(m?.is_active ?? true);
    setMfrModalOpen(true);
  };

  const handleSaveMfr = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_manufacturer', {
        p_id: editMfr?.id || null,
        p_name: mfrName,
        p_logo_url: mfrLogoUrl || null,
        p_is_active: mfrActive,
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: editMfr ? 'Manufacturer Updated' : 'Manufacturer Added' });
      setMfrModalOpen(false);
      await loadCatalogue();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Save Failed', message: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMfrActive = async (m: Manufacturer) => {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_manufacturer', {
        p_id: m.id,
        p_name: m.name,
        p_logo_url: m.logo_url || null,
        p_is_active: !(m.is_active ?? true),
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: m.is_active === false ? 'Manufacturer Activated' : 'Manufacturer Deactivated' });
      await loadCatalogue();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Action Failed', message: err instanceof Error ? err.message : undefined });
    }
  };

  const openModelModal = (m?: Model) => {
    setEditModel(m || null);
    setModelMfrId(m?.manufacturer_id || manufacturers[0]?.id || '');
    setModelName(m?.name || '');
    setModelBodyType(m?.body_type || 'SUV');
    setModelFuelTypes((m?.fuel_types || ['Petrol']).join(', '));
    setModelImageUrl(m?.image_url || '');
    setModelPrice(String(m?.starting_price ?? 800000));
    setModelActive(m?.is_active ?? true);
    setModelModalOpen(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const fuels = modelFuelTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { error: rpcErr } = await supabase.rpc('admin_upsert_model', {
        p_id: editModel?.id || null,
        p_manufacturer_id: modelMfrId,
        p_name: modelName,
        p_body_type: modelBodyType,
        p_fuel_types: fuels,
        p_image_url: modelImageUrl || null,
        p_starting_price: Number(modelPrice) || 0,
        p_is_active: modelActive,
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: editModel ? 'Model Updated' : 'Model Added' });
      setModelModalOpen(false);
      await loadCatalogue();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Save Failed', message: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModelActive = async (m: Model) => {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_model', {
        p_id: m.id,
        p_manufacturer_id: m.manufacturer_id,
        p_name: m.name,
        p_body_type: m.body_type,
        p_fuel_types: m.fuel_types,
        p_image_url: m.image_url || null,
        p_starting_price: m.starting_price,
        p_is_active: !(m.is_active ?? true),
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: m.is_active === false ? 'Model Activated' : 'Model Deactivated' });
      await loadCatalogue();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Action Failed', message: err instanceof Error ? err.message : undefined });
    }
  };

  const openVarModal = (v?: Variant) => {
    setEditVar(v || null);
    setVarModelId(v?.model_id || models[0]?.id || '');
    setVarName(v?.name || '');
    setVarTrans(v?.transmission || 'Manual');
    const fuel = v?.fuel_type || 'Petrol';
    setVarFuel(fuel);
    setVarEngineCc(fuel === 'Electric' ? '' : String(v?.engine_cc ?? 1197));
    setVarPrice(String(v?.ex_showroom_price ?? 950000));
    setVarFeatures((v?.features || []).join(', '));
    setVarActive(v?.is_active ?? true);
    setVarModalOpen(true);
  };

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const feats = varFeatures
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { error: rpcErr } = await supabase.rpc('admin_upsert_variant', {
        p_id: editVar?.id || null,
        p_model_id: varModelId,
        p_name: varName,
        p_transmission: varTrans,
        p_fuel_type: varFuel,
        p_engine_cc: varFuel === 'Electric' ? null : (varEngineCc ? Number(varEngineCc) : null),
        p_ex_showroom_price: Number(varPrice) || 0,
        p_features: feats,
        p_is_active: varActive,
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: editVar ? 'Variant Updated' : 'Variant Added' });
      setVarModalOpen(false);
      await loadCatalogue();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Save Failed', message: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVarActive = async (v: Variant) => {
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_variant', {
        p_id: v.id,
        p_model_id: v.model_id,
        p_name: v.name,
        p_transmission: v.transmission,
        p_fuel_type: v.fuel_type,
        p_engine_cc: v.engine_cc ?? null,
        p_ex_showroom_price: v.ex_showroom_price,
        p_features: v.features || [],
        p_is_active: !(v.is_active ?? true),
      });
      if (rpcErr) throw rpcErr;
      toast({ type: 'success', title: v.is_active === false ? 'Variant Activated' : 'Variant Deactivated' });
      await loadCatalogue();
    } catch (err: unknown) {
      toast({ type: 'error', title: 'Action Failed', message: err instanceof Error ? err.message : undefined });
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredMfrs = manufacturers.filter((m) => !q || m.name.toLowerCase().includes(q));
  const filteredModels = models.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.manufacturer?.name || '').toLowerCase().includes(q) ||
      m.body_type.toLowerCase().includes(q)
  );
  const filteredVariants = variants.filter(
    (v) =>
      !q ||
      v.name.toLowerCase().includes(q) ||
      (v.model?.name || '').toLowerCase().includes(q) ||
      (v.model?.manufacturer?.name || '').toLowerCase().includes(q)
  );

  const mfrCols: ColumnDef<Manufacturer>[] = [
    { key: 'name', header: 'Manufacturer Name', render: (m) => <span className="font-bold text-slate-900">{m.name}</span> },
    { key: 'logo_url', header: 'Logo URL', render: (m) => <span className="text-[11px] font-mono text-slate-500 truncate max-w-[200px] block">{m.logo_url || '—'}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (m) => <Badge variant={m.is_active === false ? 'danger' : 'success'} size="sm">{m.is_active === false ? 'Inactive' : 'Active'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openMfrModal(m)} leftIcon={<Edit2 className="w-3 h-3" />}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => toggleMfrActive(m)} leftIcon={<Power className="w-3 h-3" />}>
            {m.is_active === false ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  const modelCols: ColumnDef<Model>[] = [
    {
      key: 'name',
      header: 'Model',
      render: (m) => (
        <div>
          <div className="font-bold text-slate-900">{m.name}</div>
          <div className="text-[11px] text-slate-500">{m.manufacturer?.name}</div>
        </div>
      ),
    },
    { key: 'body_type', header: 'Body Type', render: (m) => <Badge variant="default" size="sm">{m.body_type}</Badge> },
    { key: 'fuel_types', header: 'Fuel Types', render: (m) => <span>{(m.fuel_types || []).join(', ')}</span> },
    { key: 'starting_price', header: 'Indicative Price', align: 'right', render: (m) => <span className="font-semibold text-slate-900">{formatINR(m.starting_price)}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (m) => <Badge variant={m.is_active === false ? 'danger' : 'success'} size="sm">{m.is_active === false ? 'Inactive' : 'Active'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openModelModal(m)} leftIcon={<Edit2 className="w-3 h-3" />}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => toggleModelActive(m)} leftIcon={<Power className="w-3 h-3" />}>
            {m.is_active === false ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  const variantCols: ColumnDef<Variant>[] = [
    {
      key: 'name',
      header: 'Variant',
      render: (v) => (
        <div>
          <div className="font-bold text-slate-900">{v.name}</div>
          <div className="text-[11px] text-slate-500">{v.model?.manufacturer?.name} {v.model?.name}</div>
        </div>
      ),
    },
    { key: 'powertrain', header: 'Powertrain', render: (v) => <span>{v.fuel_type} • {v.transmission}</span> },
    { key: 'engine_cc', header: 'Engine', align: 'right', render: (v) => <span>{v.engine_cc ? `${v.engine_cc} cc` : 'EV'}</span> },
    { key: 'ex_showroom_price', header: 'Ex-Showroom', align: 'right', render: (v) => <span className="font-semibold text-slate-900">{formatINR(v.ex_showroom_price)}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (v) => <Badge variant={v.is_active === false ? 'danger' : 'success'} size="sm">{v.is_active === false ? 'Inactive' : 'Active'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (v) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openVarModal(v)} leftIcon={<Edit2 className="w-3 h-3" />}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => toggleVarActive(v)} leftIcon={<Power className="w-3 h-3" />}>
            {v.is_active === false ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Vehicle Catalogue Management"
      breadcrumbs={[{ label: 'Catalogue' }]}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search brand, model..."
      headerActions={
        <Button
          variant="primary"
          size="sm"
          className="whitespace-nowrap"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            if (tab === 'manufacturers') openMfrModal();
            else if (tab === 'models') openModelModal();
            else openVarModal();
          }}
        >
          Add {tab === 'manufacturers' ? 'Manufacturer' : tab === 'models' ? 'Model' : 'Variant'}
        </Button>
      }
    >
      <Tabs
        activeTab={tab}
        onChange={(t) => setTab(t as CatalogTab)}
        tabs={[
          { id: 'manufacturers', label: 'Manufacturers', badge: manufacturers.length },
          { id: 'models', label: 'Models', badge: models.length },
          { id: 'variants', label: 'Variants', badge: variants.length },
        ]}
      />

      {tab === 'manufacturers' && (
        <DataTable columns={mfrCols} data={filteredMfrs} rowKey={(m) => m.id} isLoading={isLoading} error={error} onRetry={loadCatalogue} />
      )}
      {tab === 'models' && (
        <DataTable columns={modelCols} data={filteredModels} rowKey={(m) => m.id} isLoading={isLoading} error={error} onRetry={loadCatalogue} />
      )}
      {tab === 'variants' && (
        <DataTable columns={variantCols} data={filteredVariants} rowKey={(v) => v.id} isLoading={isLoading} error={error} onRetry={loadCatalogue} />
      )}

      {/* Manufacturer Modal */}
      <Modal isOpen={mfrModalOpen} onClose={() => setMfrModalOpen(false)} title={editMfr ? 'Edit Manufacturer' : 'Add Manufacturer'}>
        <form onSubmit={handleSaveMfr} className="space-y-4">
          <Input label="Manufacturer Name" value={mfrName} onChange={(e) => setMfrName(e.target.value)} required />
          <Input label="Logo URL (Optional)" value={mfrLogoUrl} onChange={(e) => setMfrLogoUrl(e.target.value)} placeholder="https://..." />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={mfrActive} onChange={(e) => setMfrActive(e.target.checked)} className="rounded" />
            <span>Active (visible in public catalog)</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setMfrModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>Save Manufacturer</Button>
          </div>
        </form>
      </Modal>

      {/* Model Modal */}
      <Modal isOpen={modelModalOpen} onClose={() => setModelModalOpen(false)} title={editModel ? 'Edit Car Model' : 'Add Car Model'} maxWidth="lg">
        <form onSubmit={handleSaveModel} className="space-y-4">
          <Select
            label="Manufacturer"
            value={modelMfrId}
            onChange={(e) => setModelMfrId(e.target.value)}
            options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Model Name" value={modelName} onChange={(e) => setModelName(e.target.value)} required />
            <Select
              label="Body Type"
              value={modelBodyType}
              onChange={(e) => setModelBodyType(e.target.value as Model['body_type'])}
              options={BODY_TYPES.map((b) => ({ value: b, label: b }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Fuel Types (comma separated)" value={modelFuelTypes} onChange={(e) => setModelFuelTypes(e.target.value)} required />
            <Input label="Indicative Starting Price (INR)" type="number" min="0" value={modelPrice} onChange={(e) => setModelPrice(e.target.value)} required />
          </div>
          <Input label="Image URL (optional — defaults to neutral placeholder)" value={modelImageUrl} onChange={(e) => setModelImageUrl(e.target.value)} placeholder="https://..." />
          {!modelImageUrl && <CarIllustration bodyType={modelBodyType} className="h-28" />}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={modelActive} onChange={(e) => setModelActive(e.target.checked)} className="rounded" />
            <span>Active in catalog</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModelModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>Save Model</Button>
          </div>
        </form>
      </Modal>

      {/* Variant Modal */}
      <Modal isOpen={varModalOpen} onClose={() => setVarModalOpen(false)} title={editVar ? 'Edit Variant' : 'Add Variant'} maxWidth="lg">
        <form onSubmit={handleSaveVar} className="space-y-4">
          <Select
            label="Car Model"
            value={varModelId}
            onChange={(e) => setVarModelId(e.target.value)}
            options={models.map((m) => ({ value: m.id, label: `${m.manufacturer?.name || ''} ${m.name}` }))}
            required
          />
          <Input label="Variant Name" value={varName} onChange={(e) => setVarName(e.target.value)} required placeholder="e.g. ZX+ Petrol AT" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Fuel Type"
              value={varFuel}
              onChange={(e) => {
                const nextFuel = e.target.value as Variant['fuel_type'];
                setVarFuel(nextFuel);
                if (nextFuel === 'Electric') {
                  setVarEngineCc('');
                } else if (!varEngineCc) {
                  setVarEngineCc('1197');
                }
              }}
              options={FUEL_TYPES.map((f) => ({ value: f, label: f }))}
            />
            <Select label="Transmission" value={varTrans} onChange={(e) => setVarTrans(e.target.value as Variant['transmission'])} options={TRANSMISSIONS.map((t) => ({ value: t, label: t }))} />
            <Input
              label="Engine (cc)"
              type="number"
              min="0"
              disabled={varFuel === 'Electric'}
              placeholder={varFuel === 'Electric' ? 'N/A (Electric EV)' : 'e.g. 1197'}
              value={varFuel === 'Electric' ? '' : varEngineCc}
              onChange={(e) => setVarEngineCc(e.target.value)}
            />
          </div>
          <Input label="Indicative Ex-Showroom Price (INR)" type="number" min="0" value={varPrice} onChange={(e) => setVarPrice(e.target.value)} required />
          <Input label="Key Features (comma separated)" value={varFeatures} onChange={(e) => setVarFeatures(e.target.value)} />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={varActive} onChange={(e) => setVarActive(e.target.checked)} className="rounded" />
            <span>Active for group formation</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setVarModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>Save Variant</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
