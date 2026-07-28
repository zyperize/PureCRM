import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { tasksService } from '../services/tasksService';
import toast from 'react-hot-toast';

export default function TaskTemplates() {
    const queryClient = useQueryClient();
    const [newTask, setNewTask] = useState('');

    const { data: templates, isLoading } = useQuery({
        queryKey: ['taskTemplates'],
        queryFn: () => tasksService.getTaskTemplates()
    });

    const createMutation = useMutation({
        mutationFn: async (taskName) => {
            const maxOrder = (templates || []).reduce((max, t) => Math.max(max, t.display_order), 0);
            return tasksService.createTaskTemplate({ task_name: taskName }, maxOrder + 1);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taskTemplates'] }); setNewTask(''); toast.success('Template added'); },
        onError: (error) => toast.error(error.message || 'Could not add template')
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, task_name }) => tasksService.updateTaskTemplate(id, { task_name }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taskTemplates'] }); toast.success('Template updated'); },
        onError: (error) => toast.error(error.message || 'Could not update template')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => tasksService.deactivateTaskTemplate(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taskTemplates'] }); toast.success('Template removed'); },
        onError: (error) => toast.error(error.message || 'Could not remove template')
    });

    const handleAdd = () => {
        if (!newTask.trim()) return;
        createMutation.mutate(newTask.trim());
    };

    if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Task Templates</h1>
                    <p className="text-gray-400 mt-1">Default tasks applied to new leads.</p>
                </div>
            </div>

            <div className="card space-y-4">
                {(templates || []).map((t) => (
                    <div key={t.id} className="flex items-center gap-4 bg-charcoal-900/50 p-4 rounded border border-white/5">
                        <GripVertical className="text-gray-600" size={20} />
                        <div className="flex-1">
                            <input
                                defaultValue={t.task_name}
                                onBlur={(e) => {
                                    if (e.target.value !== t.task_name) {
                                        updateMutation.mutate({ id: t.id, task_name: e.target.value });
                                    }
                                }}
                                className="bg-transparent w-full focus:outline-none text-white font-medium"
                            />
                        </div>
                        <span className="text-xs text-gray-500">Step {t.display_order}</span>
                        <button onClick={() => { if (window.confirm('Remove this template?')) deleteMutation.mutate(t.id); }} className="p-2 text-gray-500 hover:text-red-400">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}

                <div className="flex gap-2">
                    <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="New task template name..."
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button onClick={handleAdd} disabled={createMutation.isPending} className="btn-primary">
                        <Plus size={18} /> Add
                    </button>
                </div>
            </div>
        </div>
    );
}
