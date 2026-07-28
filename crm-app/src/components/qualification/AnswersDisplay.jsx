export default function AnswersDisplay({ answers }) {
    if (!answers || Object.keys(answers).length === 0) {
        return <p className="text-gray-500 text-sm italic">No qualification data recorded.</p>;
    }

    const questionMap = {
        1: 'Locations',
        2: 'Supplier',
        3: 'Volume',
        4: 'Samples?'
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            {Object.entries(answers).map(([key, value]) => (
                <div key={key} className="bg-charcoal-800 p-3 rounded border border-white/5">
                    <p className="text-xs text-gray-500 uppercase">{questionMap[key] || `Question ${key}`}</p>
                    <p className="font-medium text-white">{value}</p>
                </div>
            ))}
        </div>
    );
}
