import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Play, Pause, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const ReplayViewer = ({ contestSlug, questionId, username, onClose }) => {
    const [frames, setFrames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(0); // Relative time in ms
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    useEffect(() => {
        const fetchReplay = async () => {
            try {
                const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/typing_replay`, {
                    contest_slug: contestSlug,
                    question_id: questionId,
                    username: username
                });
                
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
                console.error("Failed to load replay:", err);
                setError("Failed to fetch typing replay from server.");
            } finally {
                setLoading(false);
            }
        };
        fetchReplay();
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
            const TICK_MS = 50; // 50ms tick rate
            interval = setInterval(() => {
                setCurrentTime(prev => {
                    const nextTime = prev + (TICK_MS * playbackSpeed * 10); // Playback speed multiplier (default 10x for contest replays to not take hours)
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50">
                    <div>
                        <h3 className="text-white font-bold text-lg">Typing Replay: <span className="text-sky-400 font-mono">{username}</span></h3>
                        <p className="text-slate-400 text-xs">Time-lapse of code construction</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex bg-slate-950">
                    {/* Left: Code & Controls */}
                    <div className="flex-1 flex flex-col p-6 relative border-r border-white/5 min-w-0">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                            <p>Fetching replay events from LeetCode...</p>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex items-center justify-center text-red-400">
                            <p className="bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-xl">{error}</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-auto bg-slate-900 border border-white/5 rounded-xl p-4 custom-scrollbar mb-6 relative group">
                                <pre className="font-mono text-sm text-slate-300 w-full whitespace-pre-wrap break-all">
                                    <code>{frames[activeIndex]?.code}</code>
                                </pre>
                            </div>

                            {/* Controls */}
                            <div className="bg-slate-800/80 backdrop-blur border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <button 
                                        onClick={() => { setCurrentTime(0); setIsPlaying(false); }}
                                        className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-lg"
                                        title="Rewind to start"
                                    >
                                        <SkipBack className="w-4 h-4" />
                                    </button>
                                    
                                    <button 
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className={clsx(
                                            "flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-colors",
                                            isPlaying ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        )}
                                    >
                                        {isPlaying ? <><Pause className="w-4 h-4"/> Pause</> : <><Play className="w-4 h-4"/> Play</>}
                                    </button>

                                    <button 
                                        onClick={() => { setCurrentTime(duration); setIsPlaying(false); }}
                                        className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-lg"
                                        title="Skip to end"
                                    >
                                        <SkipForward className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-2 ml-4">
                                        <span className="text-xs text-slate-500">Speed:</span>
                                        <select 
                                            value={playbackSpeed} 
                                            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                            className="bg-slate-900 border border-white/10 text-white text-xs rounded px-2 py-1 outline-none"
                                        >
                                            <option value={1}>1x</option>
                                            <option value={2}>2x</option>
                                            <option value={5}>5x</option>
                                            <option value={10}>10x</option>
                                            <option value={20}>20x</option>
                                            <option value={50}>50x</option>
                                        </select>
                                    </div>

                                    <div className="ml-auto text-sm text-slate-400 font-mono">
                                        Time: <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(duration)}
                                    </div>
                                </div>

                                {/* Timeline Slider */}
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-slate-500 font-mono">{formatTime(0)}</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max={duration} 
                                        value={currentTime}
                                        onChange={handleSliderChange}
                                        className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                    <span className="text-xs text-slate-500 font-mono">{formatTime(duration)}</span>
                                </div>
                                <p className="text-center text-[10px] text-slate-500 mt-2 italic">Drag slider to scrub through the exact timing of the user's keystrokes.</p>
                            </div>
                        </>
                    )}
                    </div>
                    
                    {/* Right: Timeline Sidebar */}
                    {!loading && !error && (
                        <div className="w-64 bg-slate-900/30 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-white/5 bg-slate-900/50">
                                <h4 className="text-white font-semibold text-sm">Timeline</h4>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {timelineEvents.length === 0 ? (
                                    <div className="text-xs text-slate-500 text-center mt-4">No significant events</div>
                                ) : (
                                    timelineEvents.map((evt, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => {
                                                setCurrentTime(evt.timestamp - startTime);
                                                setIsPlaying(false);
                                            }}
                                            className={clsx(
                                                "p-3 rounded-lg border cursor-pointer transition-all",
                                                evt.timestamp - startTime <= currentTime && evt.timestamp - startTime > currentTime - 2000
                                                    ? "bg-slate-800 border-sky-500/50" 
                                                    : "bg-slate-800/40 border-white/5 hover:border-white/20 hover:bg-slate-800"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-semibold text-slate-300">
                                                    {evt.event === 'run_code' && 'Run Code'}
                                                    {evt.event === 'submit_code' && 'Submit Code'}
                                                    {evt.event === 'switch_language' && 'Switch Language'}
                                                    {evt.event === 'external_paste' && 'External Paste'}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-500">{formatTime(evt.timestamp - startTime)}</span>
                                            </div>
                                            
                                            {/* Status Badge */}
                                            {evt.event === 'switch_language' && (
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300">{evt.lang}</span>
                                            )}
                                            {evt.event === 'external_paste' && (
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                                                    size &gt; {evt.chars} chars
                                                </span>
                                            )}
                                            {(evt.event === 'run_code' || evt.event === 'submit_code') && (
                                                <span className={clsx(
                                                    "inline-block px-2 py-0.5 rounded text-[10px] border",
                                                    evt.status === 10 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                    evt.status === 11 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                    "bg-slate-700 text-slate-300 border-transparent"
                                                )}>
                                                    {evt.status === 10 ? 'Accepted' : evt.status === 11 ? 'Wrong Answer' : `Status: ${evt.status}`}
                                                </span>
                                            )}
                                        </div>
                                    ))
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
