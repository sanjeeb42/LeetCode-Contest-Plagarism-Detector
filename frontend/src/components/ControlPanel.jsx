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

const ActionCard = ({ title, description, icon: Icon, onClick, status, progress, color, disabled }) => {
    const styles = variants[color] || variants.blue;
    const isLoading = status === 'running';
    const isSuccess = status === 'success';

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            disabled={isLoading || disabled}
            className={clsx(
                "relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 w-full text-left overflow-hidden group",
                "bg-slate-800/50 backdrop-blur-sm border-white/5 hover:border-white/10",
                isLoading ? "cursor-wait opacity-80" : "cursor-pointer",
                disabled && "opacity-50 grayscale cursor-not-allowed",
                isSuccess && "border-emerald-500/30 bg-emerald-500/5"
            )}
        >
            <div className={clsx(
                "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500",
                styles.overlay
            )} />

            <div className="flex justify-between w-full mb-4">
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

            <h3 className="text-lg font-bold text-slate-100 mb-1">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">{description}</p>

            {isLoading && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50">
                    <motion.div
                        className={clsx("h-full", styles.loader)}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress || 0}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    />
                </div>
            )}
        </motion.button>
    );
};

const ControlPanel = ({ onRefresh, contestSlug }) => {
    const [taskStatus, setTaskStatus] = useState({
        fetch: { status: 'idle', progress: 0 },
        analyze: { status: 'idle', progress: 0 }
    });

    const pollStatus = async (taskName) => {
        const interval = setInterval(async () => {
            try {
                const resp = await axios.get(`http://127.0.0.1:5050/api/status?contest_slug=${contestSlug}`);
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

    const triggerTask = async (task, endpoint) => {
        setTaskStatus(prev => ({ ...prev, [task]: { status: 'running', progress: 0 } }));

        try {
            await axios.post(`http://127.0.0.1:5050/api/${endpoint}`, { contest_slug: contestSlug });
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
                onClick={() => triggerTask('fetch', 'fetch')}
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
