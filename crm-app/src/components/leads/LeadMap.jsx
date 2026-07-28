import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2 } from 'lucide-react';
import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { leadsService } from '../../services/leadsService';

const createCustomIcon = (stage) => {
    const color = stage === 'won' ? 'green' : stage === 'interested' || stage === 'qualified' ? 'gold' : 'blue';
    const iconMarkup = renderToStaticMarkup(
        <div style={{ color: color === 'gold' ? '#D4AF37' : color === 'green' ? '#22c55e' : '#3b82f6' }}>
            <MapPin size={32} fill="currentColor" stroke="white" strokeWidth={1.5} />
        </div>
    );
    return divIcon({ html: iconMarkup, className: 'custom-marker-icon', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
};

export default function LeadMap() {
    const navigate = useNavigate();

    const { data: leads, isLoading } = useQuery({
        queryKey: ['mapLeads'],
        queryFn: () => leadsService.getMapLeads()
    });

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Map View</h1>
                    <p className="text-gray-400 mt-1">{leads?.length || 0} leads with coordinates</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>
            ) : !(leads && leads.length) ? (
                <div className="card flex-1 flex flex-col items-center justify-center text-center p-8 border border-white/10 rounded-xl">
                    <MapPin className="w-10 h-10 text-gray-600 mb-3" />
                    <h3 className="text-lg font-bold text-white mb-1">No mapped leads yet</h3>
                    <p className="text-sm text-gray-400 max-w-md">
                        None of your leads have latitude/longitude coordinates, so there's nothing to plot.
                        Leads need to be geocoded from their address before they appear here — the imported
                        data didn't include coordinates.
                    </p>
                </div>
            ) : (
                <div className="card p-0 flex-1 overflow-hidden border border-white/10 rounded-xl relative z-0">
                    <MapContainer center={[37.0902, -95.7129]} zoom={4} scrollWheelZoom={true} className="h-full w-full">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        {(leads || []).map(lead => (
                            <Marker key={lead.id} position={[lead.latitude, lead.longitude]} icon={createCustomIcon(lead.lead_stage)}>
                                <Popup className="custom-popup">
                                    <div className="p-1">
                                        <h3 className="font-bold text-charcoal-900">{lead.business_name}</h3>
                                        <p className="text-xs text-charcoal-600 mb-2">{lead.city}, {lead.state}</p>
                                        <button onClick={() => navigate(`/leads/${lead.id}`)} className="btn-primary text-xs py-1 px-2 w-full">View Details</button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            )}
        </div>
    );
}
