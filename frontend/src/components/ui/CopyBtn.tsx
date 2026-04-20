import { useState, type FC } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyBtnProps {
  text: string;
}

const CopyBtn: FC<CopyBtnProps> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
    >
      {copied
        ? <Check size={12} className="text-emerald-400" />
        : <Copy size={12} />}
    </button>
  );
};

export default CopyBtn;
