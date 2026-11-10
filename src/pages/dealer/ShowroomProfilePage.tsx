import React, { useState, useEffect } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchDistricts, fetchManufacturers } from '@/lib/catalogService';
import { supabase } from '@/lib/supabase';
import { District } from '@/types';
import { Building2, Save, FileText, Phone, Mail, MapPin, Check, AlertCircle } from 'lucide-react';

const FALLBACK_BRANDS = [
  'Tata Motors',
  'Hyundai',
  'Mahindra',
  'Maruti Suzuki',
  'Kia',
  'Toyota',
  'Volkswagen',
  'Skoda',
  'Honda',
  'MG',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function ShowroomProfilePage() {
  const { dealership, dealerUserRole, refreshProfile } = useAuth();
  const { toast } = useToast();

  const isOwner = dealerUserRole === 'owner';

  const [districts, setDistricts] = useState<District[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>(FALLBACK_BRANDS);
  const [name, setName] = useState(dealership?.name || '');
  const [address, setAddress] = useState(dealership?.address || '');
  const [phone, setPhone] = useState(dealership?.contact_phone || '');
  const [email, setEmail] = useState(dealership?.contact_email || '');
  const [gstNumber, setGstNumber] = useState(dealership?.gst_number || '');
  const [mapLinkText, setMapLinkText] = useState(dealership?.map_link_text || '');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    dealership?.brands || []
  );
  const [districtId, setDistrictId] = useState(dealership?.district_id || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchDistricts(), fetchManufacturers()])
      .then(([dList, mList]) => {
        setDistricts(dList);
        if (dList.length > 0) {
          setDistrictId((prev) => prev || dList[0].id);
        }
        if (mList.length > 0) {
          setAvailableBrands(mList.map((m) => m.name));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (dealership) {
      setName(dealership.name);
      setAddress(dealership.address);
      setPhone(dealership.contact_phone);
      setEmail(dealership.contact_email);
      setGstNumber(dealership.gst_number);
      setMapLinkText(dealership.map_link_text || '');
      if (dealership.district_id) setDistrictId(dealership.district_id);
      if (dealership.brands) setSelectedBrands(dealership.brands);
    }
  }, [dealership]);

  const toggleBrand = (b: string) => {
    if (!isOwner) return;
    if (selectedBrands.includes(b)) {
      if (selectedBrands.length > 1) {
        setSelectedBrands(selectedBrands.filter((item) => item !== b));
      }
    } else {
      setSelectedBrands([...selectedBrands, b]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealership || !isOwner || isLoading) return;

    const normalizedGst = gstNumber.trim().toUpperCase();
    if (!GSTIN_REGEX.test(normalizedGst)) {
      toast({
        type: 'error',
        title: 'Invalid GSTIN',
        message: 'Enter a valid 15-character Indian GSTIN (e.g. 29AAAAA0000A1Z5).',
      });
      return;
    }
    if (!/^[+\d\s-]{10,16}$/.test(phone.trim())) {
      toast({
        type: 'error',
        title: 'Invalid Phone',
        message: 'Enter a valid 10-digit showroom telephone number.',
      });
      return;
    }

    const oldPrimary = dealership.district_id || '';
    const existingDistricts = dealership.districts || [];
    const preservedExtras = existingDistricts.filter((id) => id !== oldPrimary);
    const nextDistricts = Array.from(
      new Set([districtId, ...preservedExtras].filter(Boolean))
    );

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('dealerships')
        .update({
          name: name.trim(),
          address: address.trim(),
          contact_phone: phone.trim(),
          contact_email: email.trim(),
          gst_number: normalizedGst,
          map_link_text: mapLinkText.trim() || null,
          district_id: districtId || null,
          districts: nextDistricts,
          brands: selectedBrands,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealership.id);

      if (error) {
        toast({ type: 'error', title: 'Update Failed', message: error.message });
        return;
      }

      await refreshProfile();
      toast({
        type: 'success',
        title: 'Showroom Profile Saved',
        message: 'Showroom details and brand authorization matrix updated.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Showroom Profile & Dealership Settings
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Update your commercial details, dealership license, and OEM franchise brands.
          </p>
        </div>

        {!isOwner && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You are signed in as showroom <strong>staff</strong>. Only the dealership owner can update commercial profile settings.
            </span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">Dealership Identity</CardTitle>
              <CardDescription>Legal name and statutory GST registration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Showroom Legal Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                leftIcon={<Building2 className="w-4 h-4" />}
              />

              <Input
                label="GSTIN Identification"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                required
                leftIcon={<FileText className="w-4 h-4" />}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Official Telephone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  leftIcon={<Phone className="w-4 h-4" />}
                />
                <Input
                  label="Official Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                />
              </div>

              <Select
                label="Primary Operating District"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                options={districts.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.state})`,
                }))}
              />

              <Input
                label="Physical Address & Landmarking"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                leftIcon={<MapPin className="w-4 h-4" />}
              />

              <Input
                label="Google Maps Location Link"
                placeholder="https://maps.google.com/..."
                value={mapLinkText}
                onChange={(e) => setMapLinkText(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                Authorized OEM Franchise Brands
              </CardTitle>
              <CardDescription>
                You will only receive quotation tenders for vehicles belonging to your authorized brands.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {availableBrands.map((brand) => {
                  const isSelected = selectedBrands.includes(brand);
                  return (
                    <button
                      type="button"
                      key={brand}
                      disabled={!isOwner}
                      onClick={() => toggleBrand(brand)}
                      className={`text-xs px-3.5 py-2 rounded-xl font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      } ${!isOwner ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-400" />}
                      <span>{brand}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {isOwner && (
            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} leftIcon={<Save className="w-4 h-4" />}>
              Save Showroom Profile
            </Button>
          )}
        </form>
      </div>
    </DealerLayout>
  );
}
