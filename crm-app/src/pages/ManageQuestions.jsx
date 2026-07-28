import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qualificationService } from '../services/qualificationService';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, GripVertical, Save, Loader2 } from 'lucide-react';

export default function ManageQuestions() {
    const queryClient = useQueryClient();
    const [draftQuestions, setDraftQuestions] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch questions from database
    const { data: dbQuestions, isLoading, error } = useQuery({
        queryKey: ['qualification-questions'],
        queryFn: () => qualificationService.getQuestions()
    });

    const questions = draftQuestions ?? dbQuestions ?? [];

    const updateDraftQuestions = (updater) => {
        setDraftQuestions(prev => {
            const base = prev ?? dbQuestions ?? [];
            return typeof updater === 'function' ? updater(base) : updater;
        });
    };

    const addQuestion = () => {
        const newQuestion = {
            id: `temp-${Date.now()}`,
            question: '',
            display_order: questions.length,
            active: true,
            isNew: true
        };
        updateDraftQuestions(prev => [...prev, newQuestion]);
        setHasChanges(true);
    };

    const removeQuestion = (id) => {
        updateDraftQuestions(prev => prev.filter(q => q.id !== id));
        setHasChanges(true);
    };

    const updateQuestion = (id, field, value) => {
        updateDraftQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
        setHasChanges(true);
    };

    // Save all questions mutation
    const saveQuestionsMutation = useMutation({
        mutationFn: async () => {
            // Get original question IDs from database
            const originalIds = new Set(dbQuestions?.map(q => q.id) || []);

            // Find deleted questions
            const deletedIds = [...originalIds].filter(id => !questions.find(q => q.id === id));

            // Delete removed questions
            await Promise.all(deletedIds.map(id => qualificationService.deleteQuestion(id)));

            // Update or create questions
            await Promise.all(
                questions.map((q, index) => {
                    if (q.isNew || typeof q.id === 'string') {
                        // Create new question
                        return qualificationService.createQuestion(q.question || 'New Question', index);
                    } else {
                        // Update existing question
                        return qualificationService.updateQuestion(q.id, {
                            question: q.question,
                            display_order: index
                        });
                    }
                })
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qualification-questions'] });
            queryClient.invalidateQueries({ queryKey: ['qualification-answers'] });
            toast.success('Questions saved successfully');
            setDraftQuestions(null);
            setHasChanges(false);
        },
        onError: (error) => {
            toast.error(`Failed to save: ${error.message}`);
        }
    });

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="card">
                    <p className="text-red-400">Error loading questions: {error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Qualification Questions</h1>
                    <p className="text-gray-400 mt-1">
                        Manage the questions asked to qualify leads.
                        {hasChanges && <span className="ml-2 text-gold-400">(Unsaved changes)</span>}
                    </p>
                </div>
                <button
                    onClick={() => saveQuestionsMutation.mutate()}
                    disabled={!hasChanges || saveQuestionsMutation.isPending}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saveQuestionsMutation.isPending ? (
                        <>
                            <Loader2 size={18} className="animate-spin" /> Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} /> Save Changes
                        </>
                    )}
                </button>
            </div>

            <div className="card space-y-4">
                {questions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No questions yet. Click "Add New Question" to get started.</p>
                    </div>
                ) : (
                    questions.map((q) => (
                        <div key={q.id} className="flex items-center gap-4 bg-charcoal-900/50 p-4 rounded border border-white/5 group hover:border-white/10 transition-colors">
                            <GripVertical className="text-gray-600 cursor-move" size={20} />

                            <div className="flex-1">
                                <input
                                    type="text"
                                    className="bg-transparent border-none text-white font-medium focus:ring-0 w-full p-0"
                                    placeholder="Enter question text..."
                                    value={q.question || ''}
                                    onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                                />
                            </div>

                            <button
                                onClick={() => removeQuestion(q.id)}
                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                )}

                <button onClick={addQuestion} className="w-full py-3 border-2 border-dashed border-white/10 rounded-lg text-gray-400 hover:border-gold-500/30 hover:text-gold-400 hover:bg-gold-500/5 transition-all flex items-center justify-center gap-2">
                    <Plus size={20} /> Add New Question
                </button>
            </div>
        </div>
    );
}
