import { UserRole } from '@/types';

/**
 * Pure admin role, validation, outlier detection, and CSV utilities.
 * Zero DOM or Supabase side effects so these can be unit-tested cleanly.
 */

export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ADMIN_IDLE_WARNING_MS = 60 * 1000; // warn 1 minute before timeout
export const ADMIN_MIN_PASSWORD_LENGTH = 12;

export function isAdminRole(role?: UserRole | string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdminRole(role?: UserRole | string | null): boolean {
  return role === 'super_admin';
}

/**
 * Evaluates password strength for Admin accounts (min 12 chars + mix of classes).
 */
export function validateAdminPassword(password: string): {
  valid: boolean;
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  error?: string;
} {
  const hasMinLength = password.length >= ADMIN_MIN_PASSWORD_LENGTH;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasMinLength) {
    return {
      valid: false,
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol,
      error: `Admin password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters long.`,
    };
  }
  if (!(hasUpper && hasLower && (hasNumber || hasSymbol))) {
    return {
      valid: false,
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol,
      error: 'Include uppercase, lowercase, and at least one number or symbol.',
    };
  }
  return { valid: true, hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol };
}

/**
 * Validates platform settings edits before submitting to RPC.
 * Rule: booking_amount + platform_fee must stay strictly below INR 10,000.
 */
export function validatePlatformSetting(
  key: string,
  value: string,
  allSettings: Record<string, string>
): { valid: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: 'Setting value cannot be empty.' };
  }

  if (key === 'fee_refund_on_dealer_fault') {
    if (trimmed !== 'true' && trimmed !== 'false') {
      return { valid: false, error: 'Value must be "true" or "false".' };
    }
    return { valid: true };
  }

  const num = Number(trimmed);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: 'Setting must be a valid number.' };
  }
  if (num < 0) {
    return { valid: false, error: 'Setting value cannot be negative.' };
  }

  if (key === 'buyer_cancel_retention_percent' && (num < 0 || num > 100)) {
    return { valid: false, error: 'Retention percentage must be between 0 and 100.' };
  }

  if (
    ['visibility_member_threshold', 'default_group_target', 'quote_validity_default_days', 'group_expiry_days_for_1_member'].includes(
      key
    ) &&
    num < 1
  ) {
    return { valid: false, error: 'Value must be at least 1.' };
  }

  if (key === 'booking_amount') {
    const fee = Number(allSettings.platform_fee ?? 100);
    if (num + fee >= 10000) {
      return {
        valid: false,
        error: `Booking amount (${num}) + platform fee (${fee}) must stay strictly below ₹10,000.`,
      };
    }
  }

  if (key === 'platform_fee') {
    const bookingAmt = Number(allSettings.booking_amount ?? 5000);
    if (bookingAmt + num >= 10000) {
      return {
        valid: false,
        error: `Booking amount (${bookingAmt}) + platform fee (${num}) must stay strictly below ₹10,000.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Computes median price and identifies outlier quotations differing by >= thresholdPercent%.
 */
export function detectQuoteOutliers<
  T extends { id: string; group_id: string; on_road_price: number; is_complete?: boolean }
>(
  quotes: T[],
  thresholdPercent: number = 15
): Map<string, { isOutlier: boolean; medianPrice: number; deviationPercent: number; direction: 'HIGH' | 'LOW' | 'NORMAL' }> {
  const result = new Map<
    string,
    { isOutlier: boolean; medianPrice: number; deviationPercent: number; direction: 'HIGH' | 'LOW' | 'NORMAL' }
  >();

  // Group quotes by group_id
  const byGroup = new Map<string, T[]>();
  for (const q of quotes) {
    const list = byGroup.get(q.group_id) || [];
    list.push(q);
    byGroup.set(q.group_id, list);
  }

  for (const [, groupQuotes] of byGroup) {
    const eligible = groupQuotes
      .filter((q) => (q.is_complete ?? true) && Number(q.on_road_price) > 0)
      .map((q) => Number(q.on_road_price))
      .sort((a, b) => a - b);

    if (eligible.length < 2) {
      for (const q of groupQuotes) {
        result.set(q.id, {
          isOutlier: false,
          medianPrice: Number(q.on_road_price) || 0,
          deviationPercent: 0,
          direction: 'NORMAL',
        });
      }
      continue;
    }

    const mid = Math.floor(eligible.length / 2);
    const median =
      eligible.length % 2 === 1 ? eligible[mid] : (eligible[mid - 1] + eligible[mid]) / 2;

    for (const q of groupQuotes) {
      const price = Number(q.on_road_price) || 0;
      const diff = median > 0 ? ((price - median) / median) * 100 : 0;
      const absDiff = Math.abs(diff);
      const isOutlier = absDiff >= thresholdPercent;
      result.set(q.id, {
        isOutlier,
        medianPrice: median,
        deviationPercent: Math.round(diff * 10) / 10,
        direction: isOutlier ? (diff > 0 ? 'HIGH' : 'LOW') : 'NORMAL',
      });
    }
  }

  return result;
}

/**
 * Generates an RFC 4180-compliant CSV string from headers & rows, defending against formula injection.
 */
export function buildCsvContent(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    // Neutralize spreadsheet formula triggers if cell starts with =, +, -, @
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    if (/[",\r\n]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  return lines.join('\r\n');
}

export function triggerCsvDownload(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Computes lowercase SHA-256 hex digest for secure admin invite token hashing.
 */
export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically strong URL-safe invite token (32 hex/base64url chars).
 */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
