import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Play, Pause, SkipBack, SkipForward, Loader2, Clock, Code2, Clipboard, Terminal, CheckCircle, XCircle, Languages } from 'lucide-react';
import clsx from 'clsx';

const ReplayViewer = ({ contestSlug, questionId, username, onClose }) => {
    const [frames, setFrames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    useEffect(() => {
        let cancelled = false;
        const fetchReplay = async () => {
            try {
                const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/typing_replay`, {
                    contest_slug: contestSlug,
                    question_id: questionId,
                    username: username
                });

                if (cancelled) return;

                if (resp.data.frames && resp.data.frames.length > 0) {
                    // Convert ISO 8601 timestamp strings to millisecond numbers
                    const parsedFrames = resp.data.frames.map(f => ({
                        ...f,
                        timestamp: new Date(f.timestamp).getTime() || 0
                    }));
                    // Sort frames by timestamp just in case
                    parsedFrames.sort((a, b) => a.timestamp - b.timestamp);
                    setFrames(parsedFrames);
                    setCurrentTime(0);
                } else {
                    setError("No replay events found for this user/question.");
                }
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load replay:", err);
                setError("Failed to fetch typing replay from server.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchReplay();
        return () => { cancelled = true; };
    }, [contestSlug, questionId, username]);

    const startTime = frames.length > 0 ? frames[0].timestamp : 0;
    const endTime = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;
    const duration = endTime > startTime ? endTime - startTime : 0;

    // Determine the active frame based on the current time
    const activeIndex = React.useMemo(() => {
        if (frames.length === 0) return 0;
        let low = 0;
        let high = frames.length - 1;
        let best = 0;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (frames[mid].timestamp - startTime <= currentTime) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return best;
    }, [frames, currentTime, startTime]);

    // Extract notable events for the timeline sidebar
    const timelineEvents = React.useMemo(() => {
        return frames.filter(f => ['run_code', 'submit_code', 'switch_language', 'external_paste'].includes(f.event));
    }, [frames]);

    // Auto-play logic based on time
    useEffect(() => {
        let interval;
        if (isPlaying && frames.length > 0) {
            const TICK_MS = 50;
            interval = setInterval(() => {
                setCurrentTime(prev => {
                    const nextTime = prev + (TICK_MS * playbackSpeed * 10);
                    if (nextTime >= duration) {
                        setIsPlaying(false);
                        return duration;
                    }
                    return nextTime;
                });
            }, TICK_MS);
        }
        return () => clearInterval(interval);
    }, [isPlaying, frames, playbackSpeed, duration]);

    const handleSliderChange = (e) => {
        setCurrentTime(parseInt(e.target.value));
        setIsPlaying(false);
    };

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Render code with line numbers
    const renderCode = (code) => {
        if (!code) return <span className="text-slate-600 italic">No code yet...</span>;
        const lines = code.split('\n');
        return lines.map((line, i) => (
            <div key={i} className="flex hover:bg-white/[0.02]">
                <span className="select-none w-12 shrink-0 text-right pr-4 text-slate-600 text-[11px] leading-[22px] font-mono border-r border-white/5 mr-4">
                    {i + 1}
                </span>
                <pre className="leading-[22px] text-[13px] m-0 p-0 font-mono whitespace-pre">{line || '\u00A0'}</pre>
            </div>
        ));
    };

    // Get icon/color for event type
    const getEventStyle = (event) => {
        switch (event) {
            case 'switch_language':
                return { icon: Languages, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'Language Switch' };
            case 'external_paste':
                return { icon: Clipboard, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'External Paste' };
            case 'run_code':
                return { icon: Terminal, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', label: 'Run Code' };
            case 'submit_code':
                return { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Submit Code' };
            default:
                return { icon: Code2, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', label: event };
        }
    };

    // Progress percentage for the seek bar fill
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Current code line count
    const currentCode = frames[activeIndex]?.code || '';
    const lineCount = currentCode ? currentCode.split('\n').length : 0;
    const charCount = currentCode.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <div
                className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-6xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col h-full max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-[#161b22]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                            <Code2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-sm leading-tight">
                                {username} <span className="text-slate-500 font-normal">· {questionId}</span>
                            </h3>
                            <p className="text-slate-500 text-[11px]">Typing Replay · Code Construction Timeline</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Live stats */}
                        {!loading && !error && (
                            <div className="hidden md:flex items-center gap-3 mr-3">
                                <span className="text-[11px] text-slate-500 font-mono">
                                    {lineCount} lines · {charCount} chars
                                </span>
                            </div>
                        )}
                        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Left: Code & Controls */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
                                </div>
                                <p className="text-sm text-slate-500">Fetching replay events...</p>
                            </div>
                        ) : error ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="bg-red-500/5 border border-red-500/20 px-8 py-5 rounded-xl text-center">
                                    <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Code Editor Area */}
                                <div className="flex-1 overflow-auto bg-[#0d1117] p-4 custom-scrollbar font-mono text-slate-300">
                                    {renderCode(currentCode)}
                                </div>

                                {/* Controls Bar */}
                                <div className="border-t border-white/[0.06] bg-[#161b22] px-5 py-3">
                                    {/* Seek Bar */}
                                    <div className="relative h-1.5 bg-slate-800 rounded-full mb-3 cursor-pointer group"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                            setCurrentTime(pct * duration);
                                            setIsPlaying(false);
                                        }}
                                    >
                                        {/* Progress fill */}
                                        <div
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-[width] duration-75"
                                            style={{ width: `${progress}%` }}
                                        />
                                        {/* Scrubber handle */}
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg shadow-black/30 border-2 border-sky-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                            style={{ left: `calc(${progress}% - 7px)` }}
                                        />
                                        {/* Event markers on the seek bar */}
                                        {timelineEvents.map((evt, i) => {
                                            const evtPct = duration > 0 ? ((evt.timestamp - startTime) / duration) * 100 : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className={clsx(
                                                        "absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
                                                        evt.event === 'external_paste' ? 'bg-rose-400' :
                                                            evt.event === 'submit_code' ? 'bg-emerald-400' :
                                                                evt.event === 'run_code' ? 'bg-sky-400' :
                                                                    'bg-violet-400'
                                                    )}
                                                    style={{ left: `${evtPct}%` }}
                                                    title={`${getEventStyle(evt.event).label} at ${formatTime(evt.timestamp - startTime)}`}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Playback Controls */}
                                    <div className="flex items-center gap-3">
                                        {/* Time */}
                                        <span className="text-xs font-mono text-slate-500 w-[90px]">
                                            <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(duration)}
                                        </span>

                                        {/* Transport Controls */}
                                        <div className="flex items-center gap-1 mx-auto">
                                            <button
                                                onClick={() => { setCurrentTime(0); setIsPlaying(false); }}
                                                className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                                                title="Rewind"
                                            >
                                                <SkipBack className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => setIsPlaying(!isPlaying)}
                                                className={clsx(
                                                    "p-2.5 rounded-full transition-all",
                                                    isPlaying
                                                        ? "bg-white/10 text-white hover:bg-white/15"
                                                        : "bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20"
                                                )}
                                            >
                                                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                            </button>

                                            <button
                                                onClick={() => { setCurrentTime(duration); setIsPlaying(false); }}
                                                className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                                                title="End"
                                            >
                                                <SkipForward className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Speed Selector */}
                                        <div className="flex items-center gap-1.5">
                                            {[1, 2, 5, 10, 20].map(speed => (
                                                <button
                                                    key={speed}
                                                    onClick={() => setPlaybackSpeed(speed)}
                                                    className={clsx(
                                                        "px-2 py-1 rounded text-[11px] font-semibold transition-colors",
                                                        playbackSpeed === speed
                                                            ? "bg-sky-500/20 text-sky-400"
                                                            : "text-slate-500 hover:text-white hover:bg-white/5"
                                                    )}
                                                >
                                                    {speed}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Timeline Sidebar */}
                    {!loading && !error && (
                        <div className="w-56 bg-[#161b22] flex flex-col overflow-hidden border-l border-white/[0.06]">
                            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <h4 className="text-slate-300 font-semibold text-xs uppercase tracking-wider">Events</h4>
                                <span className="ml-auto text-[10px] text-slate-600 font-mono">{timelineEvents.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {timelineEvents.length === 0 ? (
                                    <div className="text-xs text-slate-600 text-center mt-8">No events detected</div>
                                ) : (
                                    timelineEvents.map((evt, idx) => {
                                        const style = getEventStyle(evt.event);
                                        const EventIcon = style.icon;
                                        const isActive = evt.timestamp - startTime <= currentTime &&
                                            evt.timestamp - startTime > currentTime - 3000;

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setCurrentTime(evt.timestamp - startTime);
                                                    setIsPlaying(false);
                                                }}
                                                className={clsx(
                                                    "p-2.5 rounded-lg border cursor-pointer transition-all group/evt",
                                                    isActive
                                                        ? `${style.bg} ${style.border}`
                                                        : "border-transparent hover:bg-white/[0.03] hover:border-white/5"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <EventIcon className={clsx("w-3.5 h-3.5", isActive ? style.color : "text-slate-500 group-hover/evt:text-slate-400")} />
                                                    <span className={clsx("text-[11px] font-semibold", isActive ? "text-slate-200" : "text-slate-400")}>
                                                        {style.label}
                                                    </span>
                                                    <span className="ml-auto text-[10px] font-mono text-slate-600">
                                                        {formatTime(evt.timestamp - startTime)}
                                                    </span>
                                                </div>

                                                {/* Meta */}
                                                {evt.event === 'switch_language' && (
                                                    <span className={clsx("inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold", style.bg, style.color)}>
                                                        {evt.lang}
                                                    </span>
                                                )}
                                                {evt.event === 'external_paste' && (
                                                    <span className={clsx("inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold", style.bg, style.color)}>
                                                        {evt.chars} chars pasted
                                                    </span>
                                                )}
                                                {(evt.event === 'run_code' || evt.event === 'submit_code') && (
                                                    <span className={clsx(
                                                        "inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold",
                                                        evt.status === 10 ? "bg-emerald-500/10 text-emerald-400" :
                                                            evt.status === 11 ? "bg-red-500/10 text-red-400" :
                                                                "bg-slate-700 text-slate-400"
                                                    )}>
                                                        {evt.status === 10 ? 'Accepted' : evt.status === 11 ? 'Wrong Answer' : `Status: ${evt.status}`}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReplayViewer;
