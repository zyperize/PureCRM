import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Trash2, Calendar, Loader2 } from 'lucide-react';
import { tasksService } from '../../services/tasksService';
import { invalidateLeadWorkspace } from '../../utils/queryInvalidation';
import toast from 'react-hot-toast';

export default function TaskManager({ leadId }) {
    const [newTask, setNewTask] = useState('');
    const queryClient = useQueryClient();

    // Fetch tasks from Supabase
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['tasks', leadId],
        queryFn: () => tasksService.getTasks(leadId),
        enabled: !!leadId
    });

    // Toggle task completion
    const toggleTaskMutation = useMutation({
        mutationFn: ({ taskId, completed }) =>
            tasksService.toggleTaskComplete(taskId, completed),
        onSuccess: () => {
            invalidateLeadWorkspace(queryClient, leadId);
        },
        onError: (error) => {
            toast.error(`Failed to update task: ${error.message}`);
        }
    });

    // Create new task
    const createTaskMutation = useMutation({
        mutationFn: (taskName) =>
            tasksService.createTask(leadId, taskName, tasks?.length || 0),
        onSuccess: () => {
            invalidateLeadWorkspace(queryClient, leadId);
            setNewTask('');
            toast.success('Task added');
        },
        onError: (error) => {
            toast.error(`Failed to add task: ${error.message}`);
        }
    });

    // Delete task
    const deleteTaskMutation = useMutation({
        mutationFn: (taskId) => tasksService.deleteTask(taskId),
        onSuccess: () => {
            invalidateLeadWorkspace(queryClient, leadId);
            toast.success('Task deleted');
        },
        onError: (error) => {
            toast.error(`Failed to delete task: ${error.message}`);
        }
    });

    const addTask = () => {
        if (!newTask.trim()) return;
        createTaskMutation.mutate(newTask);
    };

    const toggleTask = (taskId, currentlyCompleted) => {
        toggleTaskMutation.mutate({ taskId, completed: !currentlyCompleted });
    };

    const removeTask = (taskId) => {
        if (!window.confirm('Delete this task?')) return;
        deleteTaskMutation.mutate(taskId);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold">Tasks ({tasks?.length || 0})</h4>
            </div>

            <div className="space-y-2">
                {tasks && tasks.length > 0 ? (
                    tasks.map(task => (
                        <div
                            key={task.id}
                            className={`flex items-center gap-3 p-3 rounded border transition-all group
                              ${task.completed
                                    ? 'bg-charcoal-900/10 border-white/5 opacity-60'
                                    : 'bg-charcoal-900/30 border-white/5 hover:border-gold-500/30'}
                           `}
                        >
                            <button
                                onClick={() => toggleTask(task.id, task.completed)}
                                disabled={toggleTaskMutation.isPending}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors disabled:opacity-50
                                 ${task.completed
                                        ? 'bg-gold-500 border-gold-500 text-charcoal-900'
                                        : 'border-gray-500 hover:border-gold-400'}
                              `}
                            >
                                {task.completed && <Check size={12} strokeWidth={3} />}
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                                    {task.task_name}
                                </p>
                                {task.due_date && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <Calendar size={10} /> {task.due_date}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={() => removeTask(task.id)}
                                disabled={deleteTaskMutation.isPending}
                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1 disabled:opacity-50"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 text-sm text-center py-4">
                        No tasks yet. Add one below!
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2 mt-4">
                <input
                    type="text"
                    className="input-field text-sm py-2"
                    placeholder="Add new task..."
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    disabled={createTaskMutation.isPending}
                />
                <button
                    onClick={addTask}
                    disabled={createTaskMutation.isPending || !newTask.trim()}
                    className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {createTaskMutation.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Plus size={18} />
                    )}
                </button>
            </div>
        </div>
    );
}
