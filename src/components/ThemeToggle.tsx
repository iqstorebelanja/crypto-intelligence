import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, ThemePreference } from '../utils/theme';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'compact', className = '' }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'segmented') {
    const options: { id: ThemePreference; label: string; icon: React.ReactNode }[] = [
      { id: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
      { id: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
      { id: 'system', label: 'System', icon: <Monitor className="w-3.5 h-3.5" /> }
    ];

    return (
      <div className={`flex items-center p-1 rounded-xl bg-[#080d16] border border-[#1b253b] font-mono text-xs ${className}`}>
        {options.map(opt => {
          const isActive = theme === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Switch to ${opt.label} mode`}
            >
              {opt.icon}
              <span className="text-[11px]">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact toggle button (cycles Dark -> Light -> System)
  const handleClick = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-xl bg-[#0d1424] hover:bg-[#131d33] border border-[#1d2b42] text-slate-300 hover:text-cyan-400 transition-all flex items-center justify-center ${className}`}
      title={`Theme: ${theme.toUpperCase()} (Click to change)`}
      aria-label="Toggle theme"
    >
      {theme === 'system' ? (
        <Monitor className="w-4 h-4 text-cyan-400" />
      ) : resolvedTheme === 'dark' ? (
        <Moon className="w-4 h-4 text-cyan-400" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500" />
      )}
    </button>
  );
};
