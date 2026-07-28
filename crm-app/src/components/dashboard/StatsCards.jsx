import { Users, PhoneCall, CheckSquare, Calendar } from 'lucide-react';

export default function StatsCards({ stats: dashboardStats }) {
    const stats = [
        {
            title: 'Total Leads',
            value: dashboardStats?.totalLeads?.toLocaleString() || '0',
            icon: Users,
            color: 'gold'
        },
        {
            title: 'Calls Today',
            value: dashboardStats?.callsToday?.toString() || '0',
            icon: PhoneCall,
            color: 'blue'
        },
        {
            title: 'Calls This Month',
            value: dashboardStats?.callsThisMonth?.toString() || '0',
            icon: Calendar,
            color: 'green'
        },
        {
            title: 'Open Tasks',
            value: dashboardStats?.openTasks?.toString() || '0',
            icon: CheckSquare,
            color: 'orange'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
                <div key={index} className="card hover:border-gold-500/30 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm font-medium">{stat.title}</p>
                            <h3 className="text-3xl font-bold mt-2 text-white group-hover:text-gold-200 transition-colors">
                                {stat.value}
                            </h3>
                        </div>

                        <div className={`p-3 rounded-lg bg-charcoal-700 group-hover:bg-gold-500/20 transition-colors
              ${stat.color === 'gold' ? 'text-gold-400' : ''}
              ${stat.color === 'blue' ? 'text-blue-400' : ''}
              ${stat.color === 'orange' ? 'text-orange-400' : ''}
              ${stat.color === 'green' ? 'text-green-400' : ''}
            `}>
                            <stat.icon size={24} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
