import type { Control } from '../types/physics';

interface Props {
    controls: Control[];
    values: Record<string, number>;
    onChange: (param: string, value: number) => void;
    onReset: () => void;
}

export function ControlPanel({ controls, values, onChange, onReset }: Props) {
    // Group controls by group name
    const groups: Record<string, Control[]> = {};
    controls.forEach((c) => {
        if (!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
    });

    return (
        <div className="w-full space-y-4">
            {/* Reset button */}
            <button
                onClick={onReset}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-purple-500 transition-all active:scale-95"
            >
                ↻ Restart Simulation
            </button>

            {Object.entries(groups).map(([group, ctrls]) => (
                <div key={group} className="bg-white/5 rounded-xl p-3 space-y-3 backdrop-blur-sm border border-white/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">{group}</h3>
                    {ctrls.map((ctrl) => {
                        const val = values[ctrl.param] ?? ctrl.default;
                        return (
                            <div key={ctrl.param} className="space-y-1 group">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs text-slate-300 font-medium">{ctrl.label}</label>
                                    <span className="text-xs tabular-nums text-slate-400">
                                        {val.toFixed(ctrl.step < 1 ? 2 : 0)} {ctrl.unit}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={ctrl.min}
                                    max={ctrl.max}
                                    step={ctrl.step}
                                    value={val}
                                    onChange={(e) => onChange(ctrl.param, parseFloat(e.target.value))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-700 accent-indigo-500"
                                />
                                <p className="text-[10px] text-slate-500 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                    {ctrl.education_note}
                                </p>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
