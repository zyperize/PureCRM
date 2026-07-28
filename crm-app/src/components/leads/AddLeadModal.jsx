import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { leadsService } from '../../services/leadsService';
import { tasksService } from '../../services/tasksService';
import { notesService } from '../../services/notesService';
import { invalidateLeadWorkspace } from '../../utils/queryInvalidation';
import toast from 'react-hot-toast';
import { track } from '../../services/analytics';

export default function AddLeadModal({ isOpen, onClose }) {
    const [formData, setFormData] = useState({
        business_name: '',
        email: '',
        phone: '',
        city: '',
        state: '',
        manager_name: '',
        notes: ''
    });

    const queryClient = useQueryClient();

    const createLeadMutation = useMutation({
        mutationFn: async (data) => {
            // Create the lead
            const lead = await leadsService.createLead({
                business_name: data.business_name || data.manager_name || data.email || data.phone,
                email: data.email || null,
                phone: data.phone,
                city: data.city,
                state: data.state,
                manager_name: data.manager_name || null,
                lead_stage: 'new',
                lead_source: 'manual_entry'
            });

            // Initialize default tasks for the new lead
            await tasksService.initializeLeadTasks(lead.id);

            // Create initial note if provided
            if (data.notes && data.notes.trim()) {
                await notesService.createNote(lead.id, data.notes, 'general');
            }

            return lead;
        },
        onSuccess: (lead) => {
            invalidateLeadWorkspace(queryClient, lead.id);
            track('lead_created', { source: 'manual', has_email: !!lead.email });
            toast.success('Lead created successfully');

            // Reset form and close modal
            setFormData({
                business_name: '',
                email: '',
                phone: '',
                city: '',
                state: '',
                manager_name: '',
                notes: ''
            });
            onClose();
        },
        onError: (error) => {
            toast.error(`Failed to create lead: ${error.message}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (![formData.business_name, formData.manager_name, formData.email, formData.phone].some((value) => value.trim())) {
            toast.error('Add a business/contact name, email, or phone');
            return;
        }

        createLeadMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="card w-full max-w-lg p-0 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-charcoal-900">
                    <h2 className="text-lg font-bold">Add New Lead</h2>
                    <button
                        onClick={onClose}
                        disabled={createLeadMutation.isPending}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="label-text">Business or Contact Name</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. Acme Services"
                                value={formData.business_name}
                                onChange={(e) => handleChange('business_name', e.target.value)}
                                disabled={createLeadMutation.isPending}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="label-text">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="contact@company.com"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                disabled={createLeadMutation.isPending}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label-text">Phone</label>
                                <input
                                    type="tel"
                                    className="input-field"
                                    placeholder="(555) 123-4567"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    disabled={createLeadMutation.isPending}
                                />
                            </div>
                            <div>
                                <label className="label-text">City</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Los Angeles"
                                    value={formData.city}
                                    onChange={(e) => handleChange('city', e.target.value)}
                                    disabled={createLeadMutation.isPending}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label-text">State</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="CA"
                                    maxLength={2}
                                    value={formData.state}
                                    onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                                    disabled={createLeadMutation.isPending}
                                />
                            </div>
                            <div>
                                <label className="label-text">Manager Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="John Doe"
                                    value={formData.manager_name}
                                    onChange={(e) => handleChange('manager_name', e.target.value)}
                                    disabled={createLeadMutation.isPending}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label-text">Notes</label>
                            <textarea
                                className="input-field resize-none h-20"
                                placeholder="Initial notes..."
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                disabled={createLeadMutation.isPending}
                            ></textarea>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-charcoal-900 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={createLeadMutation.isPending}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createLeadMutation.isPending}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {createLeadMutation.isPending ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Lead'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
