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
  login: (email: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    role?: UserRole;
    dealershipStatus?: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
    isUnconfirmedEmail?: boolean;
  }>;
  registerBuyer: (data: BuyerRegistrationData) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  registerDealer: (data: DealerRegistrationData) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error fetching profile and dealership:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndDealership(session.user.id);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
        return { success: false, error: 'Database backend is not configured.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const errorMsg = error.message;
        const isEmailNotConfirmed =
          errorMsg.toLowerCase().includes('email not confirmed') ||
          (error as any).code === 'email_not_confirmed';

        if (import.meta.env.DEV) {
          console.error('Supabase signInWithPassword error:', error);
        }

        if (isEmailNotConfirmed) {
          return {
            success: false,
            error: 'Your email address has not been verified yet.',
            isUnconfirmedEmail: true,
          };
        }

        return {
          success: false,
          error: errorMsg.toLowerCase().includes('invalid login credentials')
            ? 'Invalid email or password.'
            : errorMsg,
        };
      }

      if (data.user) {
        await fetchProfileAndDealership(data.user.id);
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        const role = (prof?.role as UserRole) || 'buyer';
        let dealershipStatus: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | undefined;

        if (role === 'dealer') {
          const { data: du } = await supabase
            .from('dealer_users')
            .select('dealership_id')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (du) {
            const { data: dRow } = await supabase
              .from('dealerships')
              .select('status')
              .eq('id', du.dealership_id)
              .maybeSingle();
            dealershipStatus = dRow?.status as any;
          }
        }

        return { success: true, role, dealershipStatus };
      }
      return { success: false, error: 'Login failed. Please check credentials.' };
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('Login error:', err);
      }
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
        return { success: false, error: 'Database backend is not configured.' };
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
        if (import.meta.env.DEV) {
          console.error('Supabase signUp buyer error:', authError);
        }
        let msg = authError.message;
        if (msg.includes('rate limit') || (authError as any).code === 'over_email_send_rate_limit') {
          msg = 'Email rate limit exceeded. Please wait a few moments before trying again or configure SMTP in Supabase.';
        } else if (msg.includes('invalid') || (authError as any).code === 'email_address_invalid') {
          msg = 'Please enter a valid email address.';
        }
        return { success: false, error: msg };
      }

      if (!authData.user) return { success: false, error: 'User creation failed.' };

      if (authData.session) {
        await fetchProfileAndDealership(authData.user.id);
        return { success: true, requiresEmailConfirmation: false };
      }

      return { success: true, requiresEmailConfirmation: true };
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('Buyer registration exception:', err);
      }
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
        return { success: false, error: 'Database backend is not configured.' };
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
        if (import.meta.env.DEV) {
          console.error('Supabase signUp dealer error:', authError);
        }
        let msg = authError.message;
        if (msg.includes('rate limit') || (authError as any).code === 'over_email_send_rate_limit') {
          msg = 'Email rate limit exceeded. Please wait a few moments before trying again or configure SMTP in Supabase.';
        } else if (msg.includes('invalid') || (authError as any).code === 'email_address_invalid') {
          msg = 'Please enter a valid email address.';
        }
        return { success: false, error: msg };
      }

      if (!authData.user) return { success: false, error: 'Dealer account creation failed.' };

      if (authData.session) {
        await fetchProfileAndDealership(authData.user.id);
        return { success: true, requiresEmailConfirmation: false };
      }

      return { success: true, requiresEmailConfirmation: true };
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('Dealer registration exception:', err);
      }
      const msg = err instanceof Error ? err.message : 'Dealer registration failed';
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
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
