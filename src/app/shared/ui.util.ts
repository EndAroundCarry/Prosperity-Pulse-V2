/**
 * Shared UI helpers previously copy-pasted across three+ components.
 */

export function getTopicIcon(topic: string): string {
  const iconMap: Record<string, string> = {
    Finance: 'account_balance',
    'Stock Market': 'trending_up',
    Cryptocurrency: 'currency_bitcoin',
    'Real Estate': 'apartment',
    Technology: 'memory',
    Healthcare: 'local_hospital',
    Economy: 'query_stats',
    Banking: 'payments',
    Energy: 'bolt',
    Markets: 'show_chart',
    Business: 'business_center',
    Earnings: 'receipt_long',
    IPO: 'rocket_launch',
    'Mergers & Acquisitions': 'handshake',
    'Financial Markets': 'candlestick_chart',
  };
  return iconMap[topic] || 'label';
}

export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'PP';
}
