import React, { useState, useMemo } from 'react';
import { Users, AlertTriangle, ShieldCheck, Code, Zap, Hash, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { useNavigate, useParams } from 'react-router-dom';

const ClusterCard = ({ cluster, index, activeTab }) => {
    const navigate = useNavigate();
    const { slug } = useParams();

    const handleClick = () => {
        navigate(`/contest/${slug}/cluster/${activeTab}`, {
            state: {
                cluster: cluster,
                clusterIndex: index
            }
        });
    };

    // Check if this cluster contains the AI Reference
    const hasAIReference = cluster.members.some(m => m.username.includes('_AI_REFERENCE_'));

    return (
        <motion.div
            layoutId={`cluster-${activeTab}-${index}`}
            onClick={handleClick}
            className={clsx(
                "group relative bg-slate-900/50 backdrop-blur-sm rounded-xl border p-5 transition-all cursor-pointer hover:shadow-2xl hover:shadow-sky-500/10 hover:-translate-y-1",
                hasAIReference
                    ? "border-red-500/50 bg-red-500/5 hover:border-red-500"
                    : "border-white/10 hover:border-sky-500/50 hover:bg-slate-800/50"
            )}
        >
            {hasAIReference && (
                <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg border border-red-400 flex items-center gap-1 z-10 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    AI MATCH
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={clsx("p-2.5 rounded-lg", hasAIReference ? "bg-red-500/20" : "bg-sky-500/20")}>
                        <Users className={clsx("w-5 h-5", hasAIReference ? "text-red-400" : "text-sky-400")} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg leading-tight">Cluster #{index + 1}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <Hash className="w-3 h-3" />
                            <span className="font-mono">ID: {Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white leading-none">{cluster.size}</div>
                    <div className="text-[10px] font-bold text-slate-500 tracking-wider mt-1">MEMBERS</div>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                {cluster.members.slice(0, 3).map((member, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center gap-2">
                            {member.username.includes('_AI_REFERENCE_') ? (
                                <Bot className="w-3 h-3 text-red-500" />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            )}
                            <span className={clsx("font-mono truncate max-w-[120px]", member.username.includes('_AI_REFERENCE_') ? "text-red-400 font-bold" : "text-slate-300")}>
                                {member.username.replace('_AI_REFERENCE_', 'AI Graph')}
                            </span>
                        </div>
                        <span className={clsx("font-mono text-xs", member.rank === "N/A" ? "text-slate-600" : "text-emerald-400")}>
                            {member.rank !== "N/A" ? `#${member.rank}` : "Ref"}
                        </span>
                    </div>
                ))}
            </div>
            {cluster.members.length > 5 && (
                <div className="text-xs text-center text-slate-500 pt-2 italic">
                    + {cluster.members.length - 5} others
                </div>
            )}

            <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div >
    );
};

const ResultsDashboard = ({ clusters }) => {
    // clusters is now an object: { "Q1": [...], "Q2": [...] }
    const questions = useMemo(() => Object.keys(clusters || {}).sort(), [clusters]);
    const [activeTab, setActiveTab] = useState(questions[0] || "Q4");

    // Ensure activeTab is valid when data likely loads/changes
    const currentClusters = clusters?.[activeTab] || [];

    // Auto-select first available tab if activeTab is empty (on first load)
    React.useEffect(() => {
        if (!questions.includes(activeTab) && questions.length > 0) {
            setActiveTab(questions[questions.length - 1]); // Default to Q4 (usually hardest/most interesting)
        }
    }, [questions, activeTab]);

    if (!clusters || Object.keys(clusters).length === 0) {
        return (
            <div className="glass-panel rounded-2xl p-12 text-center border-dashed border-slate-700">
                <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-500/50" />
                <h3 className="text-xl font-bold text-slate-200 mb-2">Systems Secure</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                    No plagiarism clusters detected above the current similarity threshold.
                    <br />Adjust the sensitivity to probe deeper.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-sky-400" />
                    <h2 className="text-lg font-bold text-white">Live Intelligence Feed</h2>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 overflow-x-auto">
                    {questions.map((q) => (
                        <button
                            key={q}
                            onClick={() => setActiveTab(q)}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all relative",
                                activeTab === q
                                    ? "text-white bg-slate-800 shadow-lg"
                                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                            )}
                        >
                            {q}
                            {activeTab === q && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 border border-sky-500/30 rounded-lg pointer-events-none"
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {currentClusters.length > 0 ? (
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {currentClusters.map((cluster, idx) => (
                            <ClusterCard key={idx} cluster={cluster} index={idx} activeTab={activeTab} />
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-12 text-center"
                    >
                        <p className="text-slate-500 italic">No clusters found for {activeTab}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ResultsDashboard;
