import React, { useState } from 'react';
import axios from 'axios';
import { Loader2, Play, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
        analyze: { status: 'idle', progress: 0 }
    });
    const [pageLimit, setPageLimit] = useState(10);

    const pollStatus = async (taskName) => {
        const interval = setInterval(async () => {
            try {
                const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/status?contest_slug=${contestSlug}`);
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
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/${endpoint}`, { contest_slug: contestSlug, ...payload });
            pollStatus(task);
        } catch (error) {
            console.error(error);
            alert(`${task} failed: ` + (error.response?.data?.error || error.message));
            setTaskStatus(prev => ({ ...prev, [task]: { status: 'idle', progress: 0 } }));
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <ActionCard
                title="Fetch Submissions"
                description="Connect to LeetCode API to retrieve latest contest data and source code."
                icon={Download}
                color="blue"
                status={taskStatus.fetch.status}
                progress={taskStatus.fetch.progress}
                onClick={() => triggerTask('fetch', 'fetch', { limit: pageLimit })}
                extraAction={
                    <div className="flex flex-col w-24">
                        <label className="text-[10px] text-slate-500 font-mono mb-1">PAGES (1≈25U)</label>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            value={pageLimit}
                            onChange={(e) => setPageLimit(parseInt(e.target.value) || 1)}
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
    );
};

export default ControlPanel;
