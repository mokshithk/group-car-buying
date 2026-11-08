import React, { useState } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { INITIAL_DISTRICTS } from '@/lib/catalogData';
import { Building2, Save, FileText, Phone, Mail, MapPin, Check } from 'lucide-react';

const ALL_BRANDS = [
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

export function ShowroomProfilePage() {
  const { dealership } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(dealership?.name || 'Apex Motors (Bengaluru)');
  const [address, setAddress] = useState(
    dealership?.address || '45 Outer Ring Road, Marathahalli, Bengaluru - 560037'
  );
  const [phone, setPhone] = useState(dealership?.contact_phone || '+91 98450 11223');
  const [email, setEmail] = useState(dealership?.contact_email || 'contact@apexmotors-fake.com');
  const [gstNumber, setGstNumber] = useState(dealership?.gst_number || '29AAAAA0000A1Z5');
  const [mapLinkText, setMapLinkText] = useState(dealership?.map_link_text || 'https://maps.google.com/?q=Apex+Motors');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    dealership?.brands || ['Tata Motors', 'Hyundai']
  );
  const [districtId, setDistrictId] = useState(
    dealership?.district_id || 'd1111111-1111-1111-1111-111111111101'
  );

  const toggleBrand = (b: string) => {
    if (selectedBrands.includes(b)) {
      if (selectedBrands.length > 1) {
        setSelectedBrands(selectedBrands.filter((item) => item !== b));
      }
    } else {
      setSelectedBrands([...selectedBrands, b]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      type: 'success',
      title: 'Showroom Profile Saved',
      message: 'Dealership credentials and operational territories updated.',
    });
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
                options={INITIAL_DISTRICTS.map((d) => ({
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
                {ALL_BRANDS.map((brand) => {
                  const isSelected = selectedBrands.includes(brand);
                  return (
                    <button
                      type="button"
                      key={brand}
                      onClick={() => toggleBrand(brand)}
                      className={`text-xs px-3.5 py-2 rounded-xl font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-400" />}
                      <span>{brand}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" variant="primary" size="lg" leftIcon={<Save className="w-4 h-4" />}>
            Save Showroom Profile
          </Button>
        </form>
      </div>
    </DealerLayout>
  );
}
