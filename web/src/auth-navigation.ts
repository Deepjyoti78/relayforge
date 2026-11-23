export const dashboardTabs = ['dashboard', 'members', 'api-keys', 'endpoints', 'destinations', 'deliveries', 'workflows', 'metrics', 'dlq', 'settings'] as const;
export type DashboardTab = typeof dashboardTabs[number];

export function readDashboardLocation() {
  const url = new URL(window.location.href);
  const segment = url.pathname.split('/')[2];
  return {
    tab: (dashboardTabs.find(tab => tab === segment) ?? 'dashboard') as DashboardTab,
    orgId: url.searchParams.get('org'),
  };
}

export function dashboardPath(tab: DashboardTab, orgId: string | null): string {
  return (tab === 'dashboard' ? '/dashboard' : '/dashboard/' + tab) + (orgId ? '?org=' + encodeURIComponent(orgId) : '');
}
