import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const ICONS = {
  light: '☀️',
  dark: '🌙',
  system: '🖥️',
};

const LABELS = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export default function ThemeToggle() {
  const { mode, cycleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleTheme}
      title={`Theme: ${LABELS[mode]} (click to change)`}
      aria-label={`Current theme: ${LABELS[mode]}. Click to switch.`}
    >
      <span aria-hidden="true">{ICONS[mode]}</span>
      <span className="theme-toggle-label">{LABELS[mode]}</span>
    </button>
  );
}