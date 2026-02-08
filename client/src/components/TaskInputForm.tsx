import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TaskInputFormProps {
  onSubmit: (description: string, taskType?: string) => void;
  isLoading: boolean;
}

const TASK_EXAMPLES = [
  { label: '🚀 Product Launch', description: 'Launch a new SaaS product with landing page, marketing campaign, and user documentation', type: 'product_launch' },
  { label: '✨ Feature Release', description: 'Release a new real-time collaboration feature with analytics tracking and updated docs', type: 'feature_release' },
  { label: '📋 General Project', description: 'Revamp the company dashboard with improved UX, better performance, and fresh content', type: 'general' },
];

export default function TaskInputForm({ onSubmit, isLoading }: TaskInputFormProps) {
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onSubmit(description.trim(), selectedType);
    }
  };

  const handleExample = (example: typeof TASK_EXAMPLES[0]) => {
    setDescription(example.description);
    setSelectedType(example.type);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-violet-600 to-indigo-600 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">🧠</span>
            Task Allocation Engine
          </h1>
          <p className="text-violet-200 mt-2 text-sm">
            Enter a project task — the engine will break it down across Tech, Marketing & Editing teams,
            then intelligently assign each sub-task to the best team member based on their skills, experience,
            availability, and performance history.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            What does the Product Manager need done?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Launch a new analytics dashboard product with full-stack implementation, go-to-market campaign, and user documentation..."
            className="w-full h-32 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none transition-all"
            disabled={isLoading}
          />

          {/* Task Type Selector */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Task Type (auto-detected if not selected)
            </label>
            <div className="flex gap-2 flex-wrap">
              {['product_launch', 'feature_release', 'general'].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSelectedType(selectedType === type ? undefined : type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    selectedType === type
                      ? 'bg-violet-100 border-violet-300 text-violet-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={!description.trim() || isLoading}
            className="mt-6 w-full h-12 text-base font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing & Allocating...
              </span>
            ) : (
              '🔍 Analyze & Allocate Tasks'
            )}
          </Button>
        </form>

        {/* Quick Examples */}
        <div className="px-8 pb-8">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Quick Examples
          </div>
          <div className="grid gap-2">
            {TASK_EXAMPLES.map((example) => (
              <button
                key={example.type}
                onClick={() => handleExample(example)}
                disabled={isLoading}
                className="text-left px-4 py-3 bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-200 rounded-xl transition-all cursor-pointer group"
              >
                <div className="text-sm font-medium text-gray-700 group-hover:text-violet-700">
                  {example.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{example.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
