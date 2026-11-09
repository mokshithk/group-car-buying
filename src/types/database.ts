/**
 * TypeScript types for all database tables, enums, views, and functions.
 */

export type UserRole = 'buyer' | 'dealer' | 'admin';

export type GroupStatus =
  | 'FORMING'
  | 'OPEN_FOR_QUOTES'
  | 'OFFERS_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type DealershipStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type DealerUserRole = 'owner' | 'staff';

export type GroupMemberStatus = 'ACTIVE' | 'LEFT' | 'BOOKED';

export type BookingStatus =
  | 'PENDING'
  | 'PAID'
  | 'DELIVERED'
  | 'CANCELLED_BY_BUYER'
  | 'CANCELLED_BY_DEALER'
  | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type RefundReason = 'BUYER_CANCEL' | 'DEALER_FAULT';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  district_id?: string;
  consent_share_details: boolean;
  created_at: string;
  updated_at: string;
}

export interface District {
  id: string;
  name: string;
  state: string;
  code: string;
  created_at: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

export interface Model {
  id: string;
  manufacturer_id: string;
  name: string;
  body_type: 'Hatchback' | 'Sedan' | 'SUV' | 'MUV' | 'EV';
  fuel_types: string[];
  image_url?: string;
  starting_price: number;
  created_at: string;
  // Joined fields
  manufacturer?: Manufacturer;
  variants?: Variant[];
}

export interface Variant {
  id: string;
  model_id: string;
  name: string;
  transmission: 'Manual' | 'Automatic' | 'iMT' | 'DCT' | 'CVT';
  fuel_type: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid';
  engine_cc?: number;
  ex_showroom_price: number;
  features: string[];
  created_at: string;
  // Joined fields
  model?: Model;
}

export interface Dealership {
  id: string;
  name: string;
  status: DealershipStatus;
  address: string;
  district_id: string;
  contact_phone: string;
  contact_email: string;
  gst_number: string;
  rejection_reason?: string;
  verified_at?: string;
  map_link_text?: string;
  brands: string[]; // Manufacturer IDs or names
  districts: string[]; // Supported District IDs
  created_at: string;
  updated_at: string;
}

export interface DealerUser {
  id: string;
  dealership_id: string;
  user_id: string;
  role: DealerUserRole;
  created_at: string;
}

export interface Group {
  id: string;
  variant_id: string;
  district_id: string;
  target_members: number;
  status: GroupStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed / joined fields
  variant?: Variant;
  district?: District;
  member_count?: number;
  bookings_so_far?: number;
  is_visible_to_dealers?: boolean;
  days_until_visible?: number;
  creator?: Profile;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  is_creator: boolean;
  joined_at: string;
  left_at?: string;
  status: GroupMemberStatus;
  // Joined profile for display
  profile?: Profile;
}

export interface Quotation {
  id: string;
  group_id: string;
  dealership_id: string;
  ex_showroom_price: number;
  insurance: number;
  registration_charges: number;
  discounts: number;
  accessories_extras: number;
  on_road_price: number;
  validity_date: string;
  terms: string;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  // Joined dealership info
  dealership?: Dealership;
}

export interface QuotationVersion {
  id: string;
  quotation_id: string;
  dealership_id: string;
  on_road_price: number;
  price_breakdown: {
    ex_showroom_price: number;
    insurance: number;
    registration_charges: number;
    discounts: number;
    accessories_extras: number;
  };
  changed_at: string;
  version_number: number;
}

export interface Interest {
  id: string;
  quotation_id: string;
  user_id: string;
  dealership_id: string;
  contacted: boolean;
  created_at: string;
  // Joined fields for dealer leads
  buyer?: Profile;
  quotation?: Quotation;
}

export interface PriceSnapshot {
  dealer_name: string;
  dealership_id: string;
  variant_name: string;
  model_name: string;
  manufacturer_name: string;
  ex_showroom_price: number;
  insurance: number;
  registration_charges: number;
  discounts: number;
  accessories_extras: number;
  on_road_price: number;
  validity_date: string;
  terms: string;
  timestamp: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  group_id: string;
  quotation_id: string;
  buyer_id: string;
  dealership_id: string;
  booking_amount: number;
  platform_fee: number;
  total_amount: number;
  status: BookingStatus;
  price_snapshot: PriceSnapshot;
  buyer_name: string;
  buyer_phone: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  dealership?: Dealership;
  group?: Group;
}

export interface Payment {
  id: string;
  booking_id: string;
  payment_id: string;
  amount: number;
  status: PaymentStatus;
  method: 'UPI' | 'CARD' | 'NET_BANKING';
  created_at: string;
}

export interface Refund {
  id: string;
  booking_id: string;
  reason: RefundReason;
  booking_amount_refunded: number;
  dealer_retained_amount: number;
  platform_fee_refunded: number;
  total_refunded: number;
  status: 'PENDING' | 'PROCESSED';
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'PRICE_CHANGE' | 'NEW_ELIGIBLE_GROUP' | 'NEW_LEAD' | 'NEW_BOOKING' | 'BOOKING_CANCELLED' | 'GENERAL';
  read: boolean;
  link_url?: string;
  created_at: string;
}

export interface DealerRating {
  id: string;
  booking_id: string;
  dealership_id: string;
  buyer_id: string;
  rating: number; // 1 to 5
  review?: string;
  created_at: string;
}

export interface Report {
  id: string;
  dealership_id: string;
  buyer_id: string;
  reason: string;
  details: string;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  variant_id: string;
  created_at: string;
  variant?: Variant;
}

export interface BuyerPreferences {
  id: string;
  user_id: string;
  district_id?: string;
  preferred_brands?: string[];
  preferred_fuel_types?: string[];
  budget_min?: number;
  budget_max?: number;
  updated_at: string;
}
