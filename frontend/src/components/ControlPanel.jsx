import React, { useState } from 'react';
import axios from 'axios';
import { Loader2, Play, Download, CheckCircle, AlertCircle, Scan, ChevronDown, ChevronUp, Bot, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const variants = {
    blue: {
        overlay: "bg-gradient-to-br from-blue-500 to-transparent",
        iconBox: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300",
        loader: "bg-blue-500",
        success: "text-blue-400"
    },
    violet: {
        overlay: "bg-gradient-to-br from-violet-500 to-transparent",
        iconBox: "bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 group-hover:text-violet-300",
        loader: "bg-violet-500",
        success: "text-violet-400"
    },
    amber: {
        overlay: "bg-gradient-to-br from-amber-500 to-transparent",
        iconBox: "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300",
        loader: "bg-amber-500",
        success: "text-amber-400"
    }
};

const ActionCard = ({ title, description, icon: Icon, onClick, status, progress, color, disabled, extraAction }) => {
    const styles = variants[color] || variants.blue;
    const isLoading = status === 'running';
    const isSuccess = status === 'success';

    return (
        <div
            className={clsx(
                "relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 w-full text-left overflow-hidden group",
                "bg-slate-800/50 backdrop-blur-sm border-white/5 hover:border-white/10",
                isSuccess && "border-emerald-500/30 bg-emerald-500/5"
            )}
        >
            {/* Background Overlay */}
            <div className={clsx(
                "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500",
                styles.overlay
            )} />

            <div className="flex justify-between w-full mb-4 relative z-10">
                <div className={clsx(
                    "p-3 rounded-xl transition-colors scale-100",
                    isSuccess ? "bg-emerald-500/10 text-emerald-400" : styles.iconBox
                )}>
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : isSuccess ? (
                        <CheckCircle className="w-6 h-6" />
                    ) : (
                        <Icon className="w-6 h-6" />
                    )}
                </div>

                {isSuccess && (
                    <motion.span
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full h-fit"
                    >
                        COMPLETED
                    </motion.span>
                )}
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-1 relative z-10">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-medium mb-4 relative z-10">{description}</p>

            <div className="w-full mt-auto relative z-10 flex gap-2">
                {extraAction}
                <button
                    onClick={onClick}
                    disabled={isLoading || disabled}
                    className={clsx(
                        "flex-1 py-2 rounded-lg font-medium transition-colors text-center text-sm",
                        isLoading ? "bg-slate-700/50 text-slate-400 cursor-wait" :
                            disabled ? "bg-slate-800 text-slate-600 cursor-not-allowed" :
                                clsx("hover:text-white", styles.loader.replace("bg-", "bg-").replace("500", "600"), "text-white bg-slate-700")
                    )}
                >
                    {isLoading ? "Running..." : "Start Task"}
                </button>
            </div>

            {isLoading && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50 z-20">
                    <motion.div
                        className={clsx("h-full", styles.loader)}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress || 0}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    />
                </div>
            )}
        </div>
    );
};

const ControlPanel = ({ onRefresh, contestSlug }) => {
    const [taskStatus, setTaskStatus] = useState({
        fetch: { status: 'idle', progress: 0 },
        analyze: { status: 'idle', progress: 0 },
        top500_scan: { status: 'idle', progress: 0 }
    });
    const [pageLimit, setPageLimit] = useState(10);
    const [scanStart, setScanStart] = useState(1);
    const [scanLimit, setScanLimit] = useState(500);
    const [selectedQuestions, setSelectedQuestions] = useState(['Q3', 'Q4']);
    const [showLegacyTools, setShowLegacyTools] = useState(false);

    const pollStatus = async (taskName) => {
        const interval = setInterval(async () => {
            try {
                const resp = await axios.get(`${import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : ''}/api/status?contest_slug=${contestSlug}`);
                const statusData = resp.data[taskName];
                const status = statusData.status;
                const progress = statusData.progress;

                setTaskStatus(prev => ({
                    ...prev,
                    [taskName]: { status, progress }
                }));

                if (status === 'success' || status === 'error') {
                    clearInterval(interval);
                    if (status === 'success') {
                        if (onRefresh) onRefresh();
                        setTimeout(() => setTaskStatus(prev => ({ ...prev, [taskName]: { status: 'idle', progress: 0 } })), 3000);
                    } else {
                        alert(`${taskName} failed: ${resp.data[taskName].message}`);
                        setTaskStatus(prev => ({ ...prev, [taskName]: { status: 'idle', progress: 0 } }));
                    }
                }
            } catch (e) {
                clearInterval(interval);
                console.error("Polling error", e);
                setTaskStatus(prev => ({ ...prev, [taskName]: { status: 'error', progress: 0 } }));
            }
        }, 1000);
    };

    const triggerTask = async (task, endpoint, payload = {}) => {
        setTaskStatus(prev => ({ ...prev, [task]: { status: 'running', progress: 0 } }));

        try {
            await axios.post(`${import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : ''}/api/${endpoint}`, { contest_slug: contestSlug, ...payload });
            pollStatus(task);
        } catch (error) {
            console.error(error);
            alert(`${task} failed: ` + (error.response?.data?.error || error.message));
            setTaskStatus(prev => ({ ...prev, [task]: { status: 'idle', progress: 0 } }));
        }
    };

    return (
        <div className="space-y-6 mb-12">
            {/* Primary Action: Autonomous Top Scan for AI */}
            <div className="p-6 md:p-8 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-900/90 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/15 transition-all duration-700" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold rounded-full tracking-wider uppercase">
                                Standalone Scanner
                            </span>
                            <span className="text-xs text-gray-400 font-mono">Zero Setup Required</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                            <Scan className="w-6 h-6 text-amber-400" />
                            Scan Top Ranks for AI
                        </h3>
                        <p className="text-sm text-gray-400 mt-1 max-w-xl">
                            Directly inspects contestants' typing replays, paste ratios, and keystroke metrics in your chosen rank range. Completely standalone—no full submission fetching needed.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to={`/contest/${contestSlug}/ai-suspects`}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-all duration-200 active:scale-95"
                        >
                            <Bot className="w-4 h-4 text-amber-400" />
                            <span>View Suspects</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </Link>

                        <button
                            onClick={() => triggerTask('top500_scan', 'top500_scan', { 
                                limit: scanLimit || 500, 
                                start_rank: scanStart || 1, 
                                questions: selectedQuestions.length > 0 ? selectedQuestions : ["Q3", "Q4"] 
                            })}
                            disabled={taskStatus.top500_scan.status === 'running'}
                            className={clsx(
                                "px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 inline-flex items-center gap-2 whitespace-nowrap active:scale-95",
                                taskStatus.top500_scan.status === 'running' 
                                    ? "bg-amber-500/30 text-amber-200 cursor-wait"
                                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20"
                            )}
                        >
                            {taskStatus.top500_scan.status === 'running' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                                    <span>Scanning Replays... {taskStatus.top500_scan.progress}%</span>
                                </>
                            ) : (
                                <>
                                    <Scan className="w-4 h-4 text-black stroke-[2.5]" />
                                    <span>Start AI Scan</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Scan Options / Configuration */}
                <div className="relative z-10 pt-5 flex flex-wrap items-center gap-6 text-sm">
                    {/* Rank Range Inputs */}
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-400 font-mono font-bold mb-1 uppercase tracking-wider">Start Rank</label>
                            <input
                                type="number"
                                min="1"
                                value={scanStart}
                                onChange={(e) => setScanStart(e.target.value === '' ? '' : parseInt(e.target.value))}
                                className="w-20 bg-slate-900/90 border border-white/10 hover:border-amber-500/50 rounded-lg text-white font-mono text-xs px-2.5 py-1.5 outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                        <span className="text-gray-500 font-mono pt-4">to</span>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-gray-400 font-mono font-bold mb-1 uppercase tracking-wider">End Rank</label>
                            <input
                                type="number"
                                min="1"
                                value={scanLimit}
                                onChange={(e) => setScanLimit(e.target.value === '' ? '' : parseInt(e.target.value))}
                                className="w-24 bg-slate-900/90 border border-white/10 hover:border-amber-500/50 rounded-lg text-white font-mono text-xs px-2.5 py-1.5 outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="h-8 w-px bg-white/10 hidden sm:block" />

                    {/* Question Selectors */}
                    <div className="flex flex-col">
                        <label className="text-[10px] text-gray-400 font-mono font-bold mb-1 uppercase tracking-wider">Target Questions</label>
                        <div className="flex items-center gap-2">
                            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
                                const isChecked = selectedQuestions.includes(q);
                                return (
                                    <button
                                        type="button"
                                        key={q}
                                        onClick={() => {
                                            if (isChecked) {
                                                setSelectedQuestions(selectedQuestions.filter(x => x !== q));
                                            } else {
                                                setSelectedQuestions([...selectedQuestions, q]);
                                            }
                                        }}
                                        className={clsx(
                                            "px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all duration-200 border",
                                            isChecked 
                                                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]" 
                                                : "bg-slate-900/60 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                                        )}
                                    >
                                        {q}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Progress bar during scan */}
                {taskStatus.top500_scan.status === 'running' && (
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-800 z-20">
                        <motion.div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${taskStatus.top500_scan.progress || 0}%` }}
                            transition={{ type: "spring", stiffness: 50, damping: 20 }}
                        />
                    </div>
                )}
            </div>

            {/* Collapsible Legacy / Heavy Tools (Fetch Submissions & JPlag Cluster Analysis) */}
            <div className="border border-white/5 bg-slate-900/30 rounded-2xl overflow-hidden backdrop-blur-sm">
                <button
                    onClick={() => setShowLegacyTools(!showLegacyTools)}
                    className="w-full px-6 py-3.5 flex items-center justify-between text-left text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <span className="text-gray-500 font-bold uppercase tracking-wider">Advanced / Legacy Tools:</span>
                        <span>Full Submission Fetching & JPlag Code Similarity Analysis</span>
                    </span>
                    {showLegacyTools ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                <AnimatePresence>
                    {showLegacyTools && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-6 border-t border-white/5"
                        >
                            <p className="text-xs text-gray-400 mb-6 max-w-2xl leading-relaxed">
                                Optional tools for downloading thousands of raw source codes and running offline JPlag AST clustering. Not needed for your fast Top Rank AI replay scanning.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ActionCard
                                    title="Fetch Submissions"
                                    description="Bulk scrape contest submissions and dump code matrix."
                                    icon={Download}
                                    color="blue"
                                    status={taskStatus.fetch.status}
                                    progress={taskStatus.fetch.progress}
                                    onClick={() => triggerTask('fetch', 'fetch', { limit: pageLimit || 10 })}
                                    extraAction={
                                        <div className="flex flex-col w-24">
                                            <label className="text-[10px] text-slate-500 font-mono mb-1">PAGES (1≈25U)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="500"
                                                value={pageLimit}
                                                onChange={(e) => setPageLimit(e.target.value === '' ? '' : parseInt(e.target.value))}
                                                className="bg-slate-900 border border-slate-700 rounded text-white text-sm px-2 py-1 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    }
                                />

                                <ActionCard
                                    title="Run Intelligence Analysis"
                                    description="Execute JPlag detection engine to identify code similarity clusters."
                                    icon={Play}
                                    color="violet"
                                    status={taskStatus.analyze.status}
                                    progress={taskStatus.analyze.progress}
                                    onClick={() => triggerTask('analyze', 'analyze')}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ControlPanel;
