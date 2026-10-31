import { SparkIcon } from './AiSuggestPanel';

// A small "AI" tag used wherever the AI does real work, so people can see
// what is AI-powered without the app shouting about it.
export default function AiBadge({ children = 'AI' }) {
  return (
    <span className="ai-badge">
      <SparkIcon /> {children}
    </span>
  );
}
