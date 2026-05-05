import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Play, Pause, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const ReplayViewer = ({ contestSlug, questionId, username, onClose }) => {
    const [frames, setFrames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const fetchReplay = async () => {
            try {
                const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/typing_replay`, {
                    contest_slug: contestSlug,
                    question_id: questionId,
                    username: username
                });
                
                if (resp.data.frames && resp.data.frames.length > 0) {
                    setFrames(resp.data.frames);
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

    // Auto-play logic
    useEffect(() => {
        let interval;
        if (isPlaying && frames.length > 0) {
            interval = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= frames.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 100); // 100ms per frame
        }
        return () => clearInterval(interval);
    }, [isPlaying, frames]);

    const handleSliderChange = (e) => {
        setCurrentIndex(parseInt(e.target.value));
        setIsPlaying(false);
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

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-6 bg-slate-950">
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
                                    <code>{frames[currentIndex]?.code}</code>
                                </pre>
                            </div>

                            {/* Controls */}
                            <div className="bg-slate-800/80 backdrop-blur border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <button 
                                        onClick={() => { setCurrentIndex(0); setIsPlaying(false); }}
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
                                        onClick={() => { setCurrentIndex(frames.length - 1); setIsPlaying(false); }}
                                        className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-lg"
                                        title="Skip to end"
                                    >
                                        <SkipForward className="w-4 h-4" />
                                    </button>

                                    <div className="ml-auto text-sm text-slate-400 font-mono">
                                        Frame: <span className="text-white">{currentIndex + 1}</span> / {frames.length}
                                    </div>
                                </div>

                                {/* Timeline Slider */}
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-slate-500 font-mono">0</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max={frames.length - 1} 
                                        value={currentIndex}
                                        onChange={handleSliderChange}
                                        className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                    <span className="text-xs text-slate-500 font-mono">{frames.length}</span>
                                </div>
                                <p className="text-center text-[10px] text-slate-500 mt-2 italic">Drag slider to scrub back and forth instantly to spot massive copy-paste jumps.</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReplayViewer;
