import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_STATS } from '@/lib/graphql/queries/user.queries';

export interface DashboardStats {
  nftsCreated: number;
  totalSales: string;
  totalViews: number;
  followers: number;
}

export const useDashboardStats = () => {
  const { data, loading, error, refetch } = useQuery<{
    dashboardStats: DashboardStats;
  }>(GET_DASHBOARD_STATS, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  return {
    stats: data?.dashboardStats,
    loading,
    error,
    refetch,
  };
};