import { useLocation } from 'react-router';
import LeadsList from '../components/leads/LeadsList';

export default function Leads() {
    const location = useLocation();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white">Leads Management</h1>
                <p className="text-sm md:text-base text-gray-400 mt-1">Manage and track every sales opportunity.</p>
            </div>

            <LeadsList key={location.search} />
        </div>
    );
}
