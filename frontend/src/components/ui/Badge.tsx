import type { FC } from 'react';
import { STATUS_STYLE } from '../../constants/index.js';

interface BadgeProps {
  label: string;
}

const Badge: FC<BadgeProps> = ({ label }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold tracking-wide ${STATUS_STYLE[label] ?? STATUS_STYLE.unavailable}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current" />
    {label.replace(/_/g, '\u00a0')}
  </span>
);

export default Badge;
