import { NavLink } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '../../services/settingsService';
import { getWorkspaceConfig } from '../../services/workspaceConfig';
import {
    LayoutDashboard,
    Users,
    Phone,
    CheckSquare,
    Settings,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Map as MapIcon,
    Bot,
    ShoppingBag,
    Copy
} from 'lucide-react';

export default function Sidebar({ isOpen, toggleSidebar }) {
    const workspace = getWorkspaceConfig();
    const workspaceLabel = `${workspace.businessName} CRM`;
    const workspaceInitial = workspace.businessName?.[0]?.toUpperCase() || 'C';
    const { data: userName } = useQuery({
        queryKey: ['userName'],
        queryFn: () => settingsService.getUserName()
    });

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Leads', path: '/leads' },
        { icon: ShoppingBag, label: 'Customers', path: '/customers' },
        { icon: Copy, label: 'Duplicates', path: '/duplicates' },
        { icon: MapIcon, label: 'Map View', path: '/map' },
        { icon: Bot, label: 'Automation', path: '/automation' },
        { icon: Phone, label: 'Calling', path: '/calling' },
        { icon: ClipboardCheck, label: 'Qualification', path: '/qualification' },
        { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <aside
            className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out bg-charcoal-900 border-r border-white/5
        ${isOpen ? 'w-20 lg:w-64' : 'w-20'}
      `}
        >
            <div className="flex items-center justify-between h-16 px-4 border-b border-white/5">
                {isOpen ? (
                    <span className="hidden truncate lg:inline text-xl font-bold text-white">
                        {workspaceLabel}
                    </span>
                ) : (
                    <span className="mx-auto text-xl font-bold text-gold-400">{workspaceInitial}</span>
                )}
                {isOpen && <span className="mx-auto text-xl font-bold text-gold-400 lg:hidden">{workspaceInitial}</span>}

                <button
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors absolute -right-3 top-6 bg-charcoal-800 border border-white/10 shadow-lg"
                >
                    {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
            </div>

            <nav className="p-3 space-y-1 mt-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex items-center px-3 py-3 rounded-lg transition-all duration-200 group relative
              ${isActive
                                ? 'bg-gradient-to-r from-gold-500/20 to-transparent text-gold-300 border-l-2 border-gold-500'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'}
            `}
                    >
                        <item.icon size={22} className={isOpen ? 'lg:mr-3 mx-auto lg:mx-0' : 'mx-auto'} />

                        {isOpen && (
                            <span className="hidden lg:inline font-medium whitespace-nowrap">{item.label}</span>
                        )}

                        <div className="absolute left-14 bg-charcoal-800 text-white text-xs px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                            {item.label}
                        </div>
                    </NavLink>
                ))}
            </nav>

            <div className="absolute bottom-0 left-0 w-full p-4 border-t border-white/5">
                <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}>
                    <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-charcoal-900 font-bold text-sm">
                        {(userName || 'U')[0].toUpperCase()}
                    </div>
                    {isOpen && (
                        <div className="hidden lg:block flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{userName || 'User'}</p>
                            <p className="text-xs text-gray-500 truncate">Admin</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
