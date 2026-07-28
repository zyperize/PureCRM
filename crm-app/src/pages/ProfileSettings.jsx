import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/settingsService';
import { User, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router';

export default function ProfileSettings() {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');

    const { isLoading } = useQuery({
        queryKey: ['userName'],
        queryFn: async () => {
            const userName = await settingsService.getUserName();
            setName(userName);
            return userName;
        }
    });

    const updateMutation = useMutation({
        mutationFn: (newName) => settingsService.setUserName(newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userName'] });
            toast.success('Name updated successfully');
        },
        onError: (error) => {
            toast.error(`Failed to update: ${error.message}`);
        }
    });

    const handleSave = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Name cannot be empty');
            return;
        }
        updateMutation.mutate(name);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <Link to="/settings" className="text-gray-400 hover:text-white">Settings</Link>
                <span className="text-gray-600">/</span>
                <span className="text-white">Profile</span>
            </div>

            <div className="card">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center">
                        <User className="text-gold-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
                        <p className="text-sm text-gray-400">Manage your personal information</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="label-text">Your Name</label>
                        <input
                            type="text"
                            className="input-field"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This name appears in the sidebar, dashboard, and calling scripts.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="btn-primary disabled:opacity-50"
                    >
                        <Save size={18} />
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}
