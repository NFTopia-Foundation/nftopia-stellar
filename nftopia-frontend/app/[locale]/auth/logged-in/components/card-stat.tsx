import { StatCardSkeleton } from "./skelletons/stat-card-skeleton"

export interface StatCardProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  change?: number;
  isLoading?: boolean;
}
export const StatCard = ({ icon: Icon, label, value, change, isLoading = false }: StatCardProps) => {
  if (isLoading) return <StatCardSkeleton />

  return (
    <div className="rounded-lg border border-nftopia-border bg-nftopia-card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <Icon className="w-8 h-8 text-nftopia-primary" />
        {change !== undefined && (
          <span className={`text-sm font-medium ${change > 0 ? "text-green-400" : "text-red-400"}`}>
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-nftopia-text mb-1">{value.toLocaleString()}</div>
      <div className="text-sm text-nftopia-subtext">{label}</div>
    </div>
  )
}
