import type { FC, ReactNode } from 'react';

interface MdProps {
  content: string;
}

// Detect error-level log lines: ERROR keyword, structured JSON error level, severity flags, stack traces
function isErrorLine(text: string): boolean {
  return /\b(ERROR)\b|"level"\s*:\s*"error"|severity.*ERROR|\[ERROR\]|"severity"\s*:\s*"ERROR"/i.test(text);
}

function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith('**'))
      parts.push(<strong key={k++} className="text-white font-semibold">{s.slice(2, -2)}</strong>);
    else if (s.startsWith('`'))
      parts.push(<code key={k++} className="font-mono text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">{s.slice(1, -1)}</code>);
    else
      parts.push(<em key={k++} className="text-slate-300 italic">{s.slice(1, -1)}</em>);
    last = m.index + s.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

const Markdown: FC<MdProps> = ({ content }) => {
  const lines = content.split('\n');
  const els: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      els.push(
        <pre key={k++} className="my-4 bg-slate-900 border border-slate-700/60 rounded-xl p-4 overflow-x-auto">
          <code className="text-sm font-mono text-slate-200">
            {codeLines.map((cl, ci) => (
              <span key={ci} className={isErrorLine(cl) ? 'text-red-400' : ''}>
                {cl}{ci < codeLines.length - 1 ? '\n' : ''}
              </span>
            ))}
          </code>
        </pre>
      );
      i++;
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,4}) (.*)/);
    if (hm) {
      const lvl = hm[1].length;
      const cls = [
        '',
        'text-xl font-bold text-white mt-6 mb-2',
        'text-lg font-semibold text-slate-100 mt-5 mb-2',
        'text-base font-semibold text-slate-200 mt-4 mb-1',
        'text-sm font-semibold text-slate-300 mt-3 mb-1',
      ][lvl];
      els.push(<p key={k++} className={cls}>{inline(hm[2])}</p>);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      els.push(<div key={k++} className="my-4 border-t border-slate-700/60" />);
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*•] /.test(line)) {
      const items: ReactNode[] = [];
      let j = 0;
      while (i < lines.length && /^[-*•] /.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*•] /, '');
        const errItem  = isErrorLine(itemText);
        items.push(
          <li key={j++} className={`flex gap-2.5 text-sm leading-relaxed ${errItem ? 'text-red-400' : 'text-slate-200'}`}>
            <span className={`mt-1.5 flex-shrink-0 text-xs ${errItem ? 'text-red-500' : 'text-indigo-400'}`}>▸</span>
            <span>{inline(itemText)}</span>
          </li>
        );
        i++;
      }
      els.push(<ul key={k++} className="space-y-1.5 my-3">{items}</ul>);
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: ReactNode[] = [];
      let n = 1;
      let j = 0;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(
          <li key={j++} className="flex gap-2.5 text-sm text-slate-200 leading-relaxed">
            <span className="text-indigo-400 font-mono text-xs mt-1 flex-shrink-0 w-4">{n++}.</span>
            <span>{inline(lines[i].replace(/^\d+\. /, ''))}</span>
          </li>
        );
        i++;
      }
      els.push(<ol key={k++} className="space-y-1.5 my-3">{items}</ol>);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    els.push(
      <p key={k++} className={`text-sm leading-relaxed mb-2 ${isErrorLine(line) ? 'text-red-400 font-mono' : 'text-slate-200'}`}>
        {inline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{els}</div>;
};

export default Markdown;
