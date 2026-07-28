import { Link } from 'react-router';
import { Phone, CheckSquare, ClipboardCheck, User, Building2, ChevronRight } from 'lucide-react';

export default function Settings() {
  const sections = [
    {
      title: 'CRM Configuration',
      items: [
        { icon: Building2, label: 'Workspace Setup', path: '/settings/workspace', desc: 'Business name and database connection' },
        { icon: Phone, label: 'Calling Scripts', path: '/settings/scripts', desc: 'Manage scripts for dialer' },
        { icon: ClipboardCheck, label: 'Qualification Questions', path: '/qualification', desc: 'Configure customized lead questions' },
        { icon: CheckSquare, label: 'Task Templates', path: '/settings/tasks', desc: 'Set up automated task lists' }
      ]
    },
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Profile Settings', path: '/settings/profile', desc: 'Your display name' }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your workspace preferences.</p>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="text-lg font-bold text-gray-300 mb-3 ml-1">{section.title}</h3>
            <div className="card p-0 overflow-hidden divide-y divide-white/5">
              {section.items.map((item, i) => (
                <Link key={i} to={item.path} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-charcoal-900 border border-white/10 flex items-center justify-center text-gold-400 group-hover:border-gold-500/30 transition-colors">
                    <item.icon size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white group-hover:text-gold-200 transition-colors">{item.label}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-gold-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
