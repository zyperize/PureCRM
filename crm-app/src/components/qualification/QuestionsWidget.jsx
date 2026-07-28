import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qualificationService } from '../../services/qualificationService';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function QuestionsWidget({ leadId, onSave }) {
    const queryClient = useQueryClient();
    const [draftAnswers, setDraftAnswers] = useState({});

    // Fetch questions from database
    const { data: questions, isLoading: questionsLoading } = useQuery({
        queryKey: ['qualification-questions'],
        queryFn: () => qualificationService.getQuestions()
    });

    // Fetch answers for this lead
    const { data: answersData, isLoading: answersLoading } = useQuery({
        queryKey: ['qualification-answers', leadId],
        queryFn: () => qualificationService.getAnswers(leadId),
        enabled: !!leadId
    });

    const savedAnswers = useMemo(() => {
        const answersObj = {};
        if (answersData && questions) {
            answersData.forEach(ans => {
                const match = questions.find(q => q.question === ans.question);
                if (match) {
                    answersObj[match.id] = ans.answer;
                }
            });
        }
        return answersObj;
    }, [answersData, questions]);

    const formState = { ...savedAnswers, ...draftAnswers };

    const saveAnswersMutation = useMutation({
        mutationFn: async (answers) => {
            const promises = Object.entries(answers).map(([questionId, answer]) => {
                const question = questions.find(q => q.id === questionId);
                if (question && answer) {
                    return qualificationService.saveAnswer(leadId, question.question, answer, question.display_order);
                }
                return Promise.resolve();
            });
            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qualification-answers', leadId] });
            queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
            toast.success('Qualification answers saved');
            if (onSave) onSave();
        },
        onError: (error) => {
            toast.error(`Failed to save answers: ${error.message}`);
        }
    });

    const handleChange = (id, value) => {
        setDraftAnswers(prev => ({ ...prev, [id]: value }));
    };

    if (questionsLoading || answersLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
        );
    }

    if (!questions || questions.length === 0) {
        return <p className="text-sm text-gray-500 py-4">No qualification questions configured. Add them in Settings.</p>;
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">Qualify this lead to move them to the next stage.</p>

            <div className="space-y-4">
                {questions.map(q => (
                    <div key={q.id}>
                        <label className="label-text">{q.question}</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Type your answer..."
                            value={formState[q.id] || ''}
                            onChange={(e) => handleChange(q.id, e.target.value)}
                        />
                    </div>
                ))}
            </div>

            <button
                onClick={() => saveAnswersMutation.mutate(formState)}
                disabled={saveAnswersMutation.isPending}
                className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saveAnswersMutation.isPending ? 'Saving...' : 'Save Answers'}
            </button>
        </div>
    );
}
