import { useState, useRef, useEffect } from 'react';
import type { Control } from '../types/physics';
import type { Mode2Schema } from '../types/physics_mode2';
import { API_BASE_URL } from '../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
    controls: Control[];
    values: Record<string, number>;
    onChange: (param: string, value: number) => void;
    onReset: () => void;
    simulationId: string;
    title?: string;
}

export function ControlPanel({ controls, values, onChange, onReset, simulationId, title }: Props) {
    const [collapsed, setCollapsed] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Group controls by group name
    const groups: Record<string, Control[]> = {};
    controls.forEach((c) => {
        if (!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const sessionId = localStorage.getItem('newton_session_id');
        if (!sessionId) {
            console.error('No session ID found');
            return;
        }

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    question: userMessage,
                    simulation_id: simulationId,
                }),
            });

            const data = await res.json();
            setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            {/* ── Collapsed state: just the toggle pill ── */}
            {collapsed && (
                <button
                    onClick={() => setCollapsed(false)}
                    className="glass-panel px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-slate-800/60 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span className="text-xs text-slate-300 font-medium">Controls</span>
                </button>
            )}

            {/* ── Expanded panel ── */}
            {!collapsed && (
                <div className="glass-panel w-80 max-h-[80vh] overflow-y-auto p-5 space-y-4">
                    {/* Header with collapse button */}
                    <div className="flex items-center justify-between">
                        {title && (
                            <h3 className="text-sm font-semibold text-white/90 truncate pr-3">{title}</h3>
                        )}
                        <button
                            onClick={() => setCollapsed(true)}
                            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Collapse panel"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>

                    {/* Chat Section (when open) */}
                    {chatOpen && (
                        <div className="border border-cyan-500/20 rounded-lg bg-slate-900/50 overflow-hidden">
                            {/* Chat Header */}
                            <div className="bg-slate-800/80 px-3 py-2 border-b border-cyan-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-semibold text-white">Physics Tutor</span>
                                </div>
                                <button
                                    onClick={() => setChatOpen(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="h-64 overflow-y-auto p-3 space-y-2">
                                {messages.length === 0 && (
                                    <div className="text-center text-slate-400 text-xs mt-8">
                                        Ask me anything about this simulation!
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] px-3 py-1.5 rounded-lg text-xs ${
                                                msg.role === 'user'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-700 text-slate-100'
                                            }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-700 px-3 py-1.5 rounded-lg">
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-2 border-t border-cyan-500/20 bg-slate-800/50">
                                <div className="flex gap-1.5">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder="Ask about the physics..."
                                        className="flex-1 bg-slate-900 text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
                                        disabled={loading}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={loading || !input.trim()}
                                        className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Slider groups (only show when chat is closed) */}
                    {!chatOpen && Object.entries(groups).map(([group, ctrls]) => (
                        <div key={group} className="space-y-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{group}</h4>
                            {ctrls.map((ctrl) => {
                                const val = values[ctrl.param] ?? ctrl.default;
                                return (
                                    <div key={ctrl.param} className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs text-white/80 font-medium">{ctrl.label}</label>
                                            <span className="text-xs tabular-nums text-cyan-400/90 font-mono">
                                                {val.toFixed(ctrl.step < 1 ? 2 : ctrl.step < 0.01 ? 4 : 0)} {ctrl.unit}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={ctrl.min}
                                            max={ctrl.max}
                                            step={ctrl.step}
                                            value={val}
                                            onChange={(e) => onChange(ctrl.param, parseFloat(e.target.value))}
                                            className="w-full"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {/* Divider + action buttons */}
                    <div className="border-t border-white/10 pt-3 space-y-2">
                        {/* Reset button */}
                        <button
                            onClick={onReset}
                            className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                        >
                            ↻ Reset Simulation
                        </button>

                        {/* Toggle Chat button */}
                        <button
                            onClick={() => setChatOpen(!chatOpen)}
                            className="w-full py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                            {chatOpen ? 'Show Controls' : 'Open Chat'}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                                {chatOpen ? (
                                    <path d="M3 12h18M3 6h18M3 18h18" />
                                ) : (
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
