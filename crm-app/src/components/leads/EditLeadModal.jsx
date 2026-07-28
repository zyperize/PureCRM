import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { leadsService } from '../../services/leadsService';
import { invalidateLeadWorkspace } from '../../utils/queryInvalidation';
import toast from 'react-hot-toast';

function leadToFormData(lead) {
    return {
        business_name: lead?.business_name || '',
        phone: lead?.phone || '',
        email: lead?.email || '',
        city: lead?.city || '',
        state: lead?.state || '',
        zipcode: lead?.zipcode || '',
        manager_name: lead?.manager_name || '',
        lead_stage: lead?.lead_stage || 'new'
    };
}

function EditLeadForm({ onClose, lead }) {
    const [formData, setFormData] = useState(() => leadToFormData(lead));

    const queryClient = useQueryClient();

    const updateLeadMutation = useMutation({
        mutationFn: (updates) => leadsService.updateLead(lead.id, updates),
        onSuccess: () => {
            invalidateLeadWorkspace(queryClient, lead.id);
            toast.success('Lead updated successfully');
            onClose();
        },
        onError: (error) => {
            toast.error(`Failed to update lead: ${error.message}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!formData.business_name.trim()) {
            toast.error('Business name is required');
            return;
        }

        updateLeadMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="card w-full max-w-lg p-0 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-charcoal-900">
                    <h2 className="text-lg font-bold">Edit Lead</h2>
                    <button
                        onClick={onClose}
                        disabled={updateLeadMutation.isPending}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="label-text">Business Name *</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.business_name}
                                onChange={(e) => handleChange('business_name', e.target.value)}
                                disabled={updateLeadMutation.isPending}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label-text">Phone</label>
                                <input
                                    type="tel"
                                    className="input-field"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    disabled={updateLeadMutation.isPending}
                                />
                            </div>
                            <div>
                                <label className="label-text">Email</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    disabled={updateLeadMutation.isPending}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="label-text">City</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.city}
                                    onChange={(e) => handleChange('city', e.target.value)}
                                    disabled={updateLeadMutation.isPending}
                                />
                            </div>
                            <div>
                                <label className="label-text">State</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    maxLength={2}
                                    value={formData.state}
                                    onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                                    disabled={updateLeadMutation.isPending}
                                />
                            </div>
                            <div>
                                <label className="label-text">Zipcode</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.zipcode}
                                    onChange={(e) => handleChange('zipcode', e.target.value)}
                                    disabled={updateLeadMutation.isPending}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label-text">Manager Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.manager_name}
                                onChange={(e) => handleChange('manager_name', e.target.value)}
                                disabled={updateLeadMutation.isPending}
                            />
                        </div>

                        <div>
                            <label className="label-text">Stage</label>
                            <select
                                className="input-field"
                                value={formData.lead_stage}
                                onChange={(e) => handleChange('lead_stage', e.target.value)}
                                disabled={updateLeadMutation.isPending}
                            >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="interested">Interested</option>
                                <option value="samples_sent">Samples Sent</option>
                                <option value="qualified">Qualified</option>
                                <option value="won">Won</option>
                                <option value="lost">Lost</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-charcoal-900 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={updateLeadMutation.isPending}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateLeadMutation.isPending}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updateLeadMutation.isPending ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function EditLeadModal({ isOpen, onClose, lead }) {
    if (!isOpen || !lead) return null;
    return <EditLeadForm key={lead.id} onClose={onClose} lead={lead} />;
}
