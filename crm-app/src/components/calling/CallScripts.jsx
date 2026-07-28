import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scriptsService } from '../../services/scriptsService';
import { settingsService } from '../../services/settingsService';
import { Loader2, AlertCircle, HelpCircle, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react';

export default function CallScripts({ lead }) {
    const { data: scripts, isLoading, error } = useQuery({
        queryKey: ['calling-scripts'],
        queryFn: () => scriptsService.getActiveScripts()
    });

    const { data: userName } = useQuery({
        queryKey: ['user-name'],
        queryFn: () => settingsService.getUserName()
    });

    const [activeScriptId, setActiveScriptId] = useState(null);
    const [selectedObjection, setSelectedObjection] = useState(null);

    // Set first script as active when data loads
    const activeScript = scripts?.find(s => s.id === activeScriptId) || scripts?.[0];

    const objections = [
        {
            id: 'no_manager',
            title: 'Manager is Out',
            icon: UserCheck,
            color: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/5',
            content: `No problem at all, I know they're busy. I can send a short overview so they can review it when they have time.

Who is the best person to address it to, and what email should I use?`
        },
        {
            id: 'expensive',
            title: 'Too Expensive',
            icon: HelpCircle,
            color: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/5',
            content: `I understand—budget has to match the value. Let me send the pricing options and expected return so you can compare them with your current approach.

Would a short proposal with the relevant tier be useful?`
        },
        {
            id: 'has_supplier',
            title: 'Has a Supplier',
            icon: RefreshCw,
            color: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/5',
            content: `That makes sense, and I am not asking you to replace a relationship that works. We may be useful as a second option when you need different coverage, capacity, or pricing.

Would it be helpful if I sent a one-page comparison for future reference?`
        },
        {
            id: 'not_interested',
            title: 'Not Interested',
            icon: AlertCircle,
            color: 'border-red-500/30 text-red-400 hover:bg-red-500/5',
            content: `I completely understand. I do not want to take more of your time.

Would you prefer that I close the loop, or send one short overview you can keep for later?`
        },
        {
            id: 'yes_next_steps',
            title: 'Yes / Next Steps',
            icon: CheckCircle2,
            color: 'border-green-500/30 text-green-400 hover:bg-green-500/5',
            content: `Great. I will send the agreed next step today.

To confirm, should I send it to [EMAIL], and is [DATE] still a good follow-up date?`
        }
    ];

    if (isLoading) {
        return (
            <div className="bg-charcoal-900 border border-white/10 rounded-lg p-4 h-full flex items-center justify-center min-h-[250px]">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-charcoal-900 border border-white/10 rounded-lg p-4 h-full min-h-[250px]">
                <p className="text-red-400">Error loading scripts: {error.message}</p>
            </div>
        );
    }

    if (!scripts || scripts.length === 0) {
        return (
            <div className="bg-charcoal-900 border border-white/10 rounded-lg p-4 h-full flex items-center justify-center min-h-[250px]">
                <p className="text-gray-500">No calling scripts available</p>
            </div>
        );
    }

    const formattedContent = activeScript
        ? scriptsService.replacePlaceholders(activeScript.script_content, lead, userName || 'User')
        : '';

    return (
        <div className="bg-charcoal-800 border border-white/10 rounded-xl p-5 h-full flex flex-col space-y-4">

            {/* Script Type Picker */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Select Pitch Script</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {scripts.map((script) => (
                        <button
                            key={script.id}
                            onClick={() => {
                                setActiveScriptId(script.id);
                                setSelectedObjection(null); // Reset objection view
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition border
                ${activeScript?.id === script.id
                                    ? 'bg-gold-500/20 text-gold-300 border-gold-500/40 shadow-lg shadow-gold-500/5'
                                    : 'bg-charcoal-800 text-gray-400 border-white/5 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {script.script_name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Objection / Response Buttons */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Live Objections & Scenarios</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {objections.map((obj) => {
                        const Icon = obj.icon;
                        const isSelected = selectedObjection?.id === obj.id;
                        return (
                            <button
                                key={obj.id}
                                onClick={() => setSelectedObjection(isSelected ? null : obj)}
                                className={`px-2 py-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1.5 transition-all
                  ${isSelected
                                    ? 'bg-gold-500/20 text-gold-300 border-gold-500/50 scale-95'
                                    : `bg-charcoal-900 border-white/5 ${obj.color}`
                                  }`}
                            >
                                <Icon size={16} />
                                <span>{obj.title}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Script Body Display */}
            <div className="flex-1 min-h-[160px] bg-charcoal-950/80 p-4 rounded-xl border border-white/5 overflow-y-auto max-h-60">
                {selectedObjection ? (
                    <div>
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
                            <selectedObjection.icon size={16} className="text-gold-400" />
                            <span className="text-xs font-bold text-gold-400 uppercase tracking-wider">RESPONSE: {selectedObjection.title}</span>
                        </div>
                        <pre className="font-sans text-sm text-white whitespace-pre-wrap leading-relaxed">
                            {scriptsService.replacePlaceholders(selectedObjection.content, lead, userName || 'User')}
                        </pre>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{activeScript?.script_name} Pitch</span>
                        </div>
                        <pre className="font-sans text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {formattedContent}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
