import { useNavigate } from 'react-router';
import { Phone, Mail, FileText, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function RecentActivity({ activities = [] }) {
    const navigate = useNavigate();

    const getActivityIcon = (activity) => {
        if (activity.type === 'call') return Phone;
        if (activity.type === 'note') {
            if (activity.subType === 'email') return Mail;
            if (activity.subType === 'call') return Phone;
            return MessageSquare;
        }
        return FileText;
    };

    const getActivityColor = (activity) => {
        if (activity.type === 'call') return 'text-blue-400';
        if (activity.type === 'note') {
            if (activity.subType === 'email') return 'text-purple-400';
            if (activity.subType === 'call') return 'text-blue-400';
            return 'text-gray-400';
        }
        return 'text-gold-400';
    };

    const getBgColor = (activity) => {
        if (activity.type === 'call') return 'bg-blue-500/10';
        if (activity.type === 'note') {
            if (activity.subType === 'email') return 'bg-purple-500/10';
            if (activity.subType === 'call') return 'bg-blue-500/10';
            return 'bg-gray-500/10';
        }
        return 'bg-gold-500/10';
    };

    const getActivityAction = (activity) => {
        if (activity.type === 'call') return 'called';
        if (activity.type === 'note') {
            if (activity.subType === 'email') return 'emailed';
            if (activity.subType === 'call') return 'logged call with';
            return 'added note to';
        }
        return 'activity';
    };

    return (
        <div className="card h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Recent Activity</h3>
                <button
                    onClick={() => navigate('/calling')}
                    className="text-gold-400 text-sm hover:text-gold-300 font-medium"
                >
                    View All
                </button>
            </div>

            <div className="space-y-6">
                {activities.length > 0 ? (
                    activities.map((activity) => {
                        const Icon = getActivityIcon(activity);
                        const color = getActivityColor(activity);
                        const bgColor = getBgColor(activity);
                        const action = getActivityAction(activity);

                        return (
                            <div key={`${activity.type}-${activity.id}`} className="relative pl-6 pb-6 last:pb-0 border-l border-white/10 last:border-0 group">
                                <div className={`absolute -left-3 top-0 w-6 h-6 rounded-full border border-charcoal-800 flex items-center justify-center ${bgColor} ${color}`}>
                                    <Icon size={14} />
                                </div>

                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                    <div className="w-full">
                                        <p className="text-sm text-gray-300">
                                            <span className="font-semibold text-white">You</span> {action}{' '}
                                            <span className="font-semibold text-gold-200">{activity.business_name}</span>
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1 mb-2">
                                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                        </p>

                                        {activity.content && (
                                            <div className="bg-charcoal-900/50 p-3 rounded-lg border border-white/5 text-sm text-gray-400 group-hover:border-white/10 transition-colors">
                                                {activity.content.length > 150
                                                    ? `${activity.content.substring(0, 150)}...`
                                                    : activity.content}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-gray-500 text-center py-8">No recent activity</p>
                )}
            </div>
        </div>
    );
}
