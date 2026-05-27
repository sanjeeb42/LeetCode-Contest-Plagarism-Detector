import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Play, Pause, SkipBack, SkipForward, Loader2, Clock, Code2, Clipboard, Terminal, CheckCircle, XCircle, Languages, ExternalLink, Settings, List } from 'lucide-react';
import clsx from 'clsx';
import Prism from 'prismjs';

// Prism CSS and languages
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';

const ReplayViewer = ({ contestSlug, questionId, username, userSlug, onClose }) => {
    const [frames, setFrames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showPostSubmit, setShowPostSubmit] = useState(true);

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
                    const parsedFrames = resp.data.frames.map(f => ({
                        ...f,
                        timestamp: new Date(f.timestamp).getTime() || 0
                    }));
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

    const filteredFrames = React.useMemo(() => {
        if (frames.length === 0) return [];
        if (showPostSubmit) return frames;

        // Find last submit_code event
        const subEvents = frames.filter(f => f.event === 'submit_code');
        if (subEvents.length === 0) return frames;

        const lastSub = subEvents[subEvents.length - 1];
        const cutoff = lastSub.timestamp;

        // Keep all frames up to and including the cutoff timestamp
        return frames.filter(f => f.timestamp <= cutoff);
    }, [frames, showPostSubmit]);

    const startTime = filteredFrames.length > 0 ? filteredFrames[0].timestamp : 0;
    const endTime = filteredFrames.length > 0 ? filteredFrames[filteredFrames.length - 1].timestamp : 0;
    const duration = endTime > startTime ? endTime - startTime : 0;

    const activeIndex = React.useMemo(() => {
        if (filteredFrames.length === 0) return 0;
        let low = 0;
        let high = filteredFrames.length - 1;
        let best = 0;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (filteredFrames[mid].timestamp - startTime <= currentTime) {
                best = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return best;
    }, [filteredFrames, currentTime, startTime]);

    const timelineEvents = React.useMemo(() => {
        return filteredFrames.filter(f => ['run_code', 'submit_code', 'switch_language', 'external_paste'].includes(f.event));
    }, [filteredFrames]);

    // Clamp currentTime if duration shrinks
    useEffect(() => {
        if (currentTime > duration) {
            setCurrentTime(duration);
        }
    }, [duration, currentTime]);

    useEffect(() => {
        let interval;
        if (isPlaying && filteredFrames.length > 0) {
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
    }, [isPlaying, filteredFrames, playbackSpeed, duration]);

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const activePasteHighlight = React.useMemo(() => {
        const frame = filteredFrames[activeIndex];
        if (!frame || frame.event !== 'external_paste' || !frame.text || !frame.code) return null;

        const code = frame.code;
        const text = frame.text;
        const index = code.indexOf(text);
        if (index === -1) return null;

        const beforeText = code.slice(0, index);
        const startLine = beforeText.split('\n').length - 1;
        const lineCount = text.split('\n').length;
        const endLine = startLine + lineCount - 1;

        return { startLine, endLine };
    }, [filteredFrames, activeIndex]);

    const highlightedCodeLines = React.useMemo(() => {
        const code = filteredFrames[activeIndex]?.code || '';
        if (!code) return [];
        const lines = code.split('\n');
        const lang = filteredFrames[activeIndex]?.lang || 'python3';
        const cleanLang = lang === 'python3' ? 'python' : lang;

        let prismLang = Prism.languages[cleanLang];
        if (!prismLang) {
            if (cleanLang === 'cpp' || cleanLang === 'c++') prismLang = Prism.languages.cpp;
            else if (cleanLang === 'java') prismLang = Prism.languages.java;
            else prismLang = Prism.languages.python;
        }

        return lines.map(line => {
            if (!line) return '';
            try {
                return Prism.highlight(line, prismLang || Prism.languages.javascript, cleanLang);
            } catch {
                return line;
            }
        });
    }, [filteredFrames, activeIndex]);

    const renderCode = () => {
        if (highlightedCodeLines.length === 0) {
            return <span className="text-[#5a5a5a] italic font-mono text-sm pl-4">No code yet...</span>;
        }
        return highlightedCodeLines.map((lineHtml, i) => {
            const isPasteHighlighted = activePasteHighlight && 
                i >= activePasteHighlight.startLine && 
                i <= activePasteHighlight.endLine;

            return (
                <div key={i} className={clsx(
                    "flex transition-colors duration-150", 
                    isPasteHighlighted ? "bg-[#3d2e2e] border-l-2 border-[#e53935] pl-3 -ml-4" : "hover:bg-white/[0.02]"
                )}>
                    <span className="select-none w-12 shrink-0 text-right pr-4 text-[#5a5a5a] text-[11px] leading-[22px] font-mono border-r border-[#2b2b2b] mr-4">
                        {i + 1}
                    </span>
                    <pre 
                        className="leading-[22px] text-[13px] m-0 p-0 font-mono whitespace-pre flex-1 text-[#d4d4d4] overflow-visible"
                        dangerouslySetInnerHTML={{ __html: lineHtml || '\u00A0' }}
                    />
                </div>
            );
        });
    };

    const getLangDisplay = (lang) => {
        if (!lang) return 'Text';
        if (lang === 'python3' || lang === 'python') return 'Python3';
        if (lang === 'cpp' || lang === 'c++') return 'C++';
        if (lang === 'java') return 'Java';
        return lang.charAt(0).toUpperCase() + lang.slice(1);
    };

    const togglePlaybackSpeed = () => {
        const speeds = [1, 2, 5, 10, 20];
        const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
        setPlaybackSpeed(speeds[nextIdx]);
    };

    const activeFrameLang = frames[activeIndex]?.lang || 'cpp';
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const currentCode = frames[activeIndex]?.code || '';
    const lineCount = currentCode ? currentCode.split('\n').length : 0;
    const charCount = currentCode.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm" onClick={onClose}>
            {/* Custom VS Code / LeetCode Prism style overrides */}
            <style>{`
                .prism-editor-container .token.keyword {
                    color: #569cd6 !important;
                    font-weight: 500;
                }
                .prism-editor-container .token.class-name, 
                .prism-editor-container .token.type,
                .prism-editor-container .token.class {
                    color: #4ec9b0 !important;
                }
                .prism-editor-container .token.function {
                    color: #dcdcaa !important;
                }
                .prism-editor-container .token.string {
                    color: #ce9178 !important;
                }
                .prism-editor-container .token.number {
                    color: #b5cea8 !important;
                }
                .prism-editor-container .token.comment {
                    color: #6a9955 !important;
                    font-style: italic;
                }
                .prism-editor-container .token.operator, 
                .prism-editor-container .token.punctuation {
                    color: #d4d4d4 !important;
                }
                .prism-editor-container .token.boolean {
                    color: #569cd6 !important;
                }
                .prism-editor-container .token.variable {
                    color: #9cdcfe !important;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #3a3a3a;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555555;
                }
            `}</style>

            <div
                className="bg-[#282828] border border-[#3c3c3c] rounded-xl w-full max-w-5xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-full max-h-[85vh] text-[#d4d4d4] font-sans"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#3c3c3c] bg-[#282828] select-none">
                    <div className="flex items-center text-sm font-medium text-white tracking-wide">
                        <span>Code Replay</span>
                        <span className="mx-2 text-[#6e6e6e]">|</span>
                        <span className="text-[#a0a0a0] font-normal">{getLangDisplay(activeFrameLang)}</span>
                        <span className="mx-2 text-[#6e6e6e]">|</span>
                        <a
                            href={`https://leetcode.com/u/${userSlug || username}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#a0a0a0] hover:text-white font-normal transition-colors flex items-center gap-1"
                            title="View LeetCode Profile"
                        >
                            <span>{username}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                        </a>
                    </div>
                    <div className="flex items-center gap-4">
                        {!loading && !error && (
                            <div className="text-[11px] text-[#8a8a8a] font-mono">
                                {lineCount} lines · {charCount} chars
                            </div>
                        )}
                        <button onClick={onClose} className="text-[#8a8a8a] hover:text-white transition-colors p-0.5">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Left: Code & Controls */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#1a1a1a]">
                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="w-10 h-10 text-white animate-spin" />
                                <p className="text-sm font-mono text-[#8a8a8a]">Loading typing stream...</p>
                            </div>
                        ) : error ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="bg-[#2f1b1b] border border-[#ea4a4a]/20 px-8 py-5 rounded-xl text-center max-w-sm">
                                    <XCircle className="w-8 h-8 text-[#ea4a4a] mx-auto mb-2" />
                                    <p className="text-white text-sm font-semibold">{error}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Code Editor Area */}
                                <div className="flex-1 overflow-auto bg-[#1a1a1a] p-4 custom-scrollbar font-mono text-slate-300 prism-editor-container border-b border-[#2b2b2b]">
                                    {renderCode()}
                                </div>

                                {/* Controls Bar */}
                                <div className="bg-[#262626] px-5 py-4 border-t border-[#3c3c3c]">
                                    {/* Seek Bar */}
                                    <div className="relative h-1 bg-[#3e3e3e] rounded-full mb-3.5 cursor-pointer group"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                            setCurrentTime(pct * duration);
                                            setIsPlaying(false);
                                        }}
                                    >
                                        {/* Progress fill */}
                                        <div
                                            className="absolute inset-y-0 left-0 bg-white rounded-full transition-[width] duration-75"
                                            style={{ width: `${progress}%` }}
                                        />
                                        {/* Scrubber handle */}
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                            style={{ left: `calc(${progress}% - 6px)` }}
                                        />
                                        {/* Event markers on the seek bar */}
                                        {timelineEvents.map((evt, i) => {
                                            const evtPct = duration > 0 ? ((evt.timestamp - startTime) / duration) * 100 : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className={clsx(
                                                        "absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-[#1a1a1a]",
                                                        evt.event === 'external_paste' ? 'bg-[#ef4444]' : 'bg-[#1e88e5]'
                                                    )}
                                                    style={{ left: `${evtPct}%` }}
                                                    title={`${evt.event === 'external_paste' ? 'External Paste' : evt.event} at ${formatTime(evt.timestamp - startTime)}`}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Playback Controls */}
                                    <div className="flex items-center justify-between select-none text-xs text-[#a0a0a0] font-sans">
                                        {/* Left: Play and Time */}
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <button
                                                onClick={() => setIsPlaying(!isPlaying)}
                                                className="text-white hover:text-slate-200 transition-colors"
                                            >
                                                {isPlaying ? <Pause className="w-5 h-5 fill-white stroke-none" /> : <Play className="w-5 h-5 fill-white stroke-none" />}
                                            </button>
                                            <span className="font-mono text-sm text-[#8a8a8a] mr-2">
                                                <span className="text-white font-medium">{formatTime(currentTime)}</span> / {formatTime(duration)}
                                            </span>
                                            {frames.some(f => f.event === 'submit_code') && (
                                                <label className="flex items-center gap-1.5 cursor-pointer text-[#8a8a8a] hover:text-white transition-colors text-[10px] font-sans border border-[#3c3c3c] rounded px-1.5 py-0.5 bg-[#1d1d1d]/40">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={showPostSubmit} 
                                                        onChange={(e) => setShowPostSubmit(e.target.checked)}
                                                        className="rounded accent-white w-3 h-3 bg-transparent border-[#444444]" 
                                                    />
                                                    <span>Show Post-Submit</span>
                                                </label>
                                            )}
                                        </div>

                                        {/* Right: Cycle Speed, Settings, List */}
                                        <div className="flex items-center gap-4.5">
                                            {/* Speed Cycle Button */}
                                            <button
                                                onClick={togglePlaybackSpeed}
                                                className="font-bold text-white hover:text-slate-200 transition-colors font-mono text-sm tracking-tight cursor-pointer"
                                                title="Cycle speed"
                                            >
                                                {playbackSpeed}x
                                            </button>

                                            <button className="text-[#8a8a8a] hover:text-white transition-colors" title="Settings">
                                                <Settings className="w-4.5 h-4.5" />
                                            </button>

                                            <button 
                                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                                className={clsx("transition-colors", isSidebarOpen ? "text-white" : "text-[#8a8a8a] hover:text-white")}
                                                title="Toggle timeline sidebar"
                                            >
                                                <List className="w-4.5 h-4.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Timeline Sidebar */}
                    {!loading && !error && isSidebarOpen && (
                        <div className="w-56 bg-[#202020] flex flex-col overflow-hidden border-l border-[#2d2d2d] shrink-0">
                            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar bg-[#202020]">
                                {timelineEvents.length === 0 ? (
                                    <div className="text-xs text-slate-500 text-center mt-8 select-none">No events detected</div>
                                ) : (
                                    timelineEvents.map((evt, idx) => {
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
                                                    "p-3 rounded-lg border text-xs cursor-pointer transition-all bg-[#262626]/40",
                                                    isActive
                                                        ? "bg-[#2d2d2d] border-[#444444]"
                                                        : "border-transparent hover:bg-[#2d2d2d]/60"
                                                )}
                                            >
                                                <div className="flex justify-between items-center mb-2 font-sans select-none">
                                                    <span className="font-semibold text-white">
                                                        {evt.event === 'switch_language' && "Switch Language"}
                                                        {evt.event === 'external_paste' && "External Paste"}
                                                        {evt.event === 'run_code' && "Run Code"}
                                                        {evt.event === 'submit_code' && "Submit Code"}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-[#8a8a8a]">
                                                        {formatTime(evt.timestamp - startTime)}
                                                    </span>
                                                </div>

                                                {/* Meta Row */}
                                                <div className="flex items-center justify-between select-none">
                                                    {evt.event === 'switch_language' && (
                                                        <span className="px-2 py-0.5 rounded bg-[#333333] text-[#a0a0a0] text-[10px] font-mono uppercase">
                                                            {evt.langDisplay || getLangDisplay(evt.lang)}
                                                        </span>
                                                    )}
                                                    {evt.event === 'external_paste' && (
                                                        <span className="px-2 py-0.5 rounded bg-[#3d2e2e] text-[#ea4a4a] border border-[#ea4a4a]/25 text-[10px] font-mono">
                                                            {evt.chars} chars pasted
                                                        </span>
                                                    )}
                                                    {(evt.event === 'run_code' || evt.event === 'submit_code') && (
                                                        <span className={clsx(
                                                            "px-2 py-0.5 rounded text-[10px] font-medium font-sans",
                                                            evt.status === 10 ? "bg-[#2f4234] text-[#43a047]" : "bg-[#4a2e2b] text-[#e53935]"
                                                        )}>
                                                            {evt.status === 10 ? 'Accepted' : 'Wrong Answer'}
                                                        </span>
                                                    )}
                                                    
                                                    {/* Details action link */}
                                                    {['run_code', 'submit_code'].includes(evt.event) && (
                                                        <span className="text-[10px] text-[#8a8a8a] hover:text-white flex items-center gap-0.5 transition-colors">
                                                            <span>Details</span>
                                                            {evt.event === 'submit_code' && <ExternalLink className="w-2.5 h-2.5 opacity-70" />}
                                                        </span>
                                                    )}
                                                </div>
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
