import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile, Dealership, UserRole } from '@/types';
import type { User } from '@supabase/supabase-js';

export interface BuyerRegistrationData {
  fullName: string;
  email: string;
  phone: string;
  districtId: string;
  password: string;
  consentShareDetails: boolean;
}

export interface DealerRegistrationData {
  dealershipName: string;
  ownerName: string;
  email: string;
  phone: string;
  districtId: string;
  address: string;
  gstNumber: string;
  brands: string[];
  password: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  dealership: Dealership | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  registerBuyer: (data: BuyerRegistrationData) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  registerDealer: (data: DealerRegistrationData) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setMockSession: (role: UserRole, profileData?: Partial<Profile>, dealershipData?: Partial<Dealership>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileAndDealership = useCallback(async (userId: string) => {
    try {
      if (!isSupabaseConfigured()) {
        return;
      }
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profError) throw profError;
      if (prof) {
        setProfile(prof as Profile);

        if (prof.role === 'dealer') {
          const { data: dealerUser } = await supabase
            .from('dealer_users')
            .select('dealership_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (dealerUser) {
            const { data: dealerData } = await supabase
              .from('dealerships')
              .select('*')
              .eq('id', dealerUser.dealership_id)
              .maybeSingle();

            if (dealerData) {
              setDealership(dealerData as Dealership);
            }
          }
        }
      } else {
        // Fallback: If user is authenticated in auth.users but has no profile row yet, auto-create profile from metadata
        const { data: authUserObj } = await supabase.auth.getUser();
        if (authUserObj?.user && authUserObj.user.id === userId) {
          const meta = authUserObj.user.user_metadata || {};
          const fallbackRole = (meta.role as UserRole) || 'buyer';
          const fallbackProfile: Profile = {
            id: userId,
            role: fallbackRole,
            full_name: meta.full_name || authUserObj.user.email?.split('@')[0] || 'Car Buyer',
            phone: meta.phone || '+91 98765 43210',
            district_id: meta.district_id || 'd1111111-1111-1111-1111-111111111101',
            consent_share_details: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          try {
            await supabase.from('profiles').insert(fallbackProfile);
          } catch {
            // ignore if already created
          }
          setProfile(fallbackProfile);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    // Check localStorage for mock/test session first (used by Instant Test Session & E2E tests)
    const savedMock = localStorage.getItem('autogroup_mock_session');
    if (savedMock) {
      try {
        const parsed = JSON.parse(savedMock);
        setUser({ id: parsed.profile.id, email: parsed.email } as unknown as User);
        setProfile(parsed.profile);
        setDealership(parsed.dealership || null);
        setIsLoading(false);
        return;
      } catch {
        // ignore
      }
    }

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (localStorage.getItem('autogroup_mock_session')) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndDealership(session.user.id);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('autogroup_mock_session')) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndDealership(session.user.id);
      } else {
        setProfile(null);
        setDealership(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndDealership]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        // Fallback for preview/testing when Supabase env is not yet configured
        let mockRole: UserRole = 'buyer';
        if (email.toLowerCase().includes('dealer')) mockRole = 'dealer';
        else if (email.toLowerCase().includes('admin')) mockRole = 'admin';

        const mockProf: Profile = {
          id: crypto.randomUUID(),
          role: mockRole,
          full_name: email.split('@')[0],
          phone: '+91 98765 43210',
          district_id: 'd1111111-1111-1111-1111-111111111101', // Bengaluru Urban
          consent_share_details: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        let mockDealer: Dealership | null = null;
        if (mockRole === 'dealer') {
          mockDealer = {
            id: 'e1111111-1111-1111-1111-111111111101',
            name: 'Apex Motors (Bengaluru)',
            status: 'VERIFIED',
            address: '45 Outer Ring Road, Marathahalli, Bengaluru',
            district_id: 'd1111111-1111-1111-1111-111111111101',
            contact_phone: '+91 98450 11223',
            contact_email: email,
            gst_number: '29AAAAA0000A1Z5',
            brands: ['Tata Motors', 'Hyundai'],
            districts: ['d1111111-1111-1111-1111-111111111101'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        setMockSession(mockRole, mockProf, mockDealer || undefined);
        setIsLoading(false);
        return { success: true, role: mockRole };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        let msg = error.message;
        if (msg.toLowerCase().includes('credential') || msg.toLowerCase().includes('confirm')) {
          msg = 'Invalid credentials or email not confirmed. (If you recently registered, please verify your email, or disable "Confirm email" in Supabase Auth > Providers > Email to log in immediately).';
        }
        return { success: false, error: msg };
      }

      if (data.user) {
        await fetchProfileAndDealership(data.user.id);
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        return { success: true, role: (prof?.role as UserRole) || 'buyer' };
      }
      return { success: false, error: 'Login failed' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const registerBuyer = async (data: BuyerRegistrationData): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }> => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        const mockProf: Profile = {
          id: crypto.randomUUID(),
          role: 'buyer',
          full_name: data.fullName,
          phone: data.phone,
          district_id: data.districtId,
          consent_share_details: data.consentShareDetails,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setMockSession('buyer', mockProf);
        return { success: true };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'buyer',
            full_name: data.fullName,
            phone: data.phone,
            district_id: data.districtId,
            consent_share_details: data.consentShareDetails,
          },
        },
      });

      if (authError) {
        let msg = authError.message;
        if (msg.includes('rate limit') || (authError as any).code === 'over_email_send_rate_limit') {
          msg = 'Supabase email rate limit exceeded (3/hour on free tier). In Supabase Dashboard > Authentication > Providers > Email, turn OFF "Confirm email" to enable instant registration.';
        } else if (msg.includes('invalid') || (authError as any).code === 'email_address_invalid') {
          msg = 'Please enter a valid real email address (e.g. name@gmail.com). Test domains like @example.com are blocked by Supabase.';
        }
        return { success: false, error: msg };
      }

      if (!authData.user) return { success: false, error: 'User creation failed' };

      // Client-side profile insert/upsert
      try {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          role: 'buyer',
          full_name: data.fullName,
          phone: data.phone,
          district_id: data.districtId,
          consent_share_details: data.consentShareDetails,
        });
      } catch {
        // Trigger on auth.users handles profile creation if RLS prevents anon insert
      }

      if (authData.session) {
        await fetchProfileAndDealership(authData.user.id);
        return { success: true, requiresEmailConfirmation: false };
      }

      return { success: true, requiresEmailConfirmation: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const registerDealer = async (data: DealerRegistrationData): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }> => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        const mockDealer: Dealership = {
          id: crypto.randomUUID(),
          name: data.dealershipName,
          status: 'PENDING',
          address: data.address,
          district_id: data.districtId,
          contact_phone: data.phone,
          contact_email: data.email,
          gst_number: data.gstNumber,
          brands: data.brands,
          districts: [data.districtId],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const mockProf: Profile = {
          id: crypto.randomUUID(),
          role: 'dealer',
          full_name: data.ownerName,
          phone: data.phone,
          district_id: data.districtId,
          consent_share_details: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMockSession('dealer', mockProf, mockDealer);
        return { success: true };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'dealer',
            full_name: data.ownerName,
            phone: data.phone,
            district_id: data.districtId,
            consent_share_details: true,
            dealership_name: data.dealershipName,
            dealership_address: data.address,
            gst_number: data.gstNumber,
            brands: data.brands,
          },
        },
      });

      if (authError) {
        let msg = authError.message;
        if (msg.includes('rate limit') || (authError as any).code === 'over_email_send_rate_limit') {
          msg = 'Supabase email rate limit exceeded (3/hour on free tier). In Supabase Dashboard > Authentication > Providers > Email, turn OFF "Confirm email" to enable instant registration.';
        } else if (msg.includes('invalid') || (authError as any).code === 'email_address_invalid') {
          msg = 'Please enter a valid real email address (e.g. name@gmail.com). Test domains like @example.com are blocked by Supabase.';
        }
        return { success: false, error: msg };
      }

      if (!authData.user) return { success: false, error: 'Dealer account creation failed' };

      // Client-side fallback insert if session exists
      try {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          role: 'dealer',
          full_name: data.ownerName,
          phone: data.phone,
          district_id: data.districtId,
          consent_share_details: true,
        });

        const { data: dealerRow } = await supabase
          .from('dealerships')
          .insert({
            name: data.dealershipName,
            status: 'PENDING',
            address: data.address,
            district_id: data.districtId,
            contact_phone: data.phone,
            contact_email: data.email,
            gst_number: data.gstNumber,
            brands: data.brands,
            districts: [data.districtId],
          })
          .select()
          .maybeSingle();

        if (dealerRow) {
          await supabase.from('dealer_users').insert({
            dealership_id: dealerRow.id,
            user_id: authData.user.id,
            role: 'owner',
          });
        }
      } catch {
        // Trigger on auth.users handles dealership & dealer_users creation if RLS prevents client insert
      }

      if (authData.session) {
        await fetchProfileAndDealership(authData.user.id);
        return { success: true, requiresEmailConfirmation: false };
      }

      return { success: true, requiresEmailConfirmation: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dealer registration failed';
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('autogroup_mock_session');
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setDealership(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndDealership(user.id);
    }
  };

  const setMockSession = (
    role: UserRole,
    profileData?: Partial<Profile>,
    dealershipData?: Partial<Dealership>
  ) => {
    const mockUser = {
      id: profileData?.id || (role === 'dealer' ? '11111111-1111-1111-1111-111111111102' : '11111111-1111-1111-1111-111111111101'),
      email: (role === 'dealer' ? 'dealer' : 'buyer') + '@example.com',
    } as unknown as User;

    const mockProf: Profile = {
      id: mockUser.id,
      role,
      full_name: profileData?.full_name || (role === 'dealer' ? 'Dealer Partner' : 'Car Buyer'),
      phone: profileData?.phone || '+91 98765 43210',
      district_id: profileData?.district_id || 'd1111111-1111-1111-1111-111111111101',
      consent_share_details: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...profileData,
    };

    let mockDealer: Dealership | null = null;
    if (role === 'dealer') {
      mockDealer = {
        id: 'e1111111-1111-1111-1111-111111111101',
        name: 'Apex Motors (Bengaluru)',
        status: 'VERIFIED',
        address: '45 Outer Ring Road, Marathahalli, Bengaluru',
        district_id: 'd1111111-1111-1111-1111-111111111101',
        contact_phone: '+91 98450 11223',
        contact_email: 'dealer@example.com',
        gst_number: '29AAAAA0000A1Z5',
        brands: ['Tata Motors', 'Hyundai'],
        districts: ['d1111111-1111-1111-1111-111111111101'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...dealershipData,
      };
    }

    setUser(mockUser);
    setProfile(mockProf);
    setDealership(mockDealer);

    localStorage.setItem(
      'autogroup_mock_session',
      JSON.stringify({
        email: mockUser.email,
        profile: mockProf,
        dealership: mockDealer,
      })
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        dealership,
        role: profile?.role ?? null,
        isLoading,
        login,
        registerBuyer,
        registerDealer,
        logout,
        refreshProfile,
        setMockSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
