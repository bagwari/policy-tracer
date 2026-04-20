import { type FC, type Ref } from 'react';
import { Send, X } from 'lucide-react';

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  running: boolean;
  textRef: Ref<HTMLTextAreaElement>;
}

const InputBar: FC<InputBarProps> = ({
  value, onChange, onSubmit, onCancel, running, textRef,
}) => (
  <div className="flex-shrink-0 px-5 py-4 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
    <div className="flex gap-3 items-end max-w-3xl mx-auto">
      <div className="flex-1 relative">
        <textarea
          ref={textRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask anything — e.g. &quot;Status of POL-2024-AUTO-001&quot;, a UUID to trace, or a natural language question. Press ⏎ to send, ⇧↵ for newline."
          rows={3}
          disabled={running}
          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 resize-none disabled:opacity-50 transition-all leading-relaxed"
        />
        <p className="absolute bottom-2 right-3 text-xs text-gray-400 select-none pointer-events-none">
          ⇧↵ newline
        </p>
      </div>

      {running ? (
        <button
          onClick={onCancel}
          title="Cancel"
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-all"
        >
          <X size={16} />
        </button>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          title="Send"
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:from-sky-400 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/40"
        >
          <Send size={15} />
        </button>
      )}
    </div>
  </div>
);

export default InputBar;
