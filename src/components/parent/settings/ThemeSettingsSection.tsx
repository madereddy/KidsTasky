import { Palette } from 'lucide-react';
import { THEMES } from '../../../constants';

type ThemeSettingsSectionProps = {
  activeThemeId: string;
  onThemeChange: (themeId: string) => void;
};

export function ThemeSettingsSection({ activeThemeId, onThemeChange }: ThemeSettingsSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Palette size={16} className="text-violet-500" />
        <h3 className="font-bold text-ui-secondary">Theme</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map(theme => {
          const active = activeThemeId === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => onThemeChange(theme.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all text-left ${active ? 'border-blue-500 bg-blue-50' : 'border-ui bg-white hover:border-blue-300'}`}
            >
              <div
                className="w-full h-8 rounded-lg border border-black/5"
                style={{ background: theme.bg }}
              />
              <span className="text-base leading-none">{theme.icon}</span>
              <span className={`text-[11px] font-semibold text-center leading-tight ${active ? 'text-blue-600' : 'text-ui-secondary'}`}>{theme.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
