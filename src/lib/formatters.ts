/**
 * AutoGroup formatting helpers.
 * Adheres strictly to Indian numbering standard (Lakhs and Crores, e.g. ₹12,80,000).
 */

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }

  // Use Intl.NumberFormat for Indian Rupee with en-IN locale
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Buyer privacy rule: members are displayed as First Name + Last Initial only.
 * e.g., "Rahul Sharma" -> "Rahul S."
 */
export function formatMemberName(fullName: string | null | undefined): string {
  if (!fullName) return 'Member';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Calculates remaining days until visibility for a group with 2 members.
 * Rule: 2 members becomes visible after 20 days.
 */
export function calculateDaysUntilVisible(
  createdAt: string,
  visibilityDays: number = 20
): { isVisible: boolean; daysRemaining: number } {
  const created = new Date(createdAt).getTime();
  const now = new Date().getTime();
  const msElapsed = now - created;
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, visibilityDays - daysElapsed);
  return {
    isVisible: daysRemaining === 0,
    daysRemaining,
  };
}
