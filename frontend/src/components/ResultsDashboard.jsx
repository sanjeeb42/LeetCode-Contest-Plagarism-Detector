import React from 'react';
import { User, AlertTriangle, ShieldCheck, Code, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const ClusterCard = ({ cluster, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className="glass-card rounded-2xl p-6 relative group overflow-hidden"
    >
        {/* Decorative Glow */}
        <div className="absolute top-0 right-0 p-20 bg-rose-500/10 blur-[60px] rounded-full -mr-10 -mt-10" />

        <div className="flex justify-between items-start mb-6 relative">
            <div>
                <span className="text-xs font-bold tracking-[0.2em] text-rose-400 uppercase mb-1 block">
                    Threat Cluster #{index + 1}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-white">{cluster.size}</span>
                    <span className="text-sm font-medium text-slate-400">Suspects</span>
                </div>
            </div>
            <div className="bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
        </div>

        <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Code className="w-3 h-3" />
                <span>Compromised Algorithms</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {cluster.questions.map((q, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 font-mono">
                        {q}
                    </span>
                ))}
            </div>
        </div>

        <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <User className="w-3 h-3" />
                <span>Identities</span>
            </div>
            <div className="space-y-2">
                {cluster.members.slice(0, 5).map((member, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-300 font-medium">{member.username}</span>
                        <span className={clsx(
                            "text-xs font-mono",
                            member.rank !== 'N/A' ? "text-amber-400" : "text-slate-600"
                        )}>
                            {member.rank !== 'N/A' ? `#${member.rank}` : 'UNRANKED'}
                        </span>
                    </div>
                ))}
                {cluster.members.length > 5 && (
                    <div className="text-xs text-center text-slate-500 pt-2 italic">
                        + {cluster.members.length - 5} others
                    </div>
                )}
            </div>
        </div>
    </motion.div>
);

const ResultsDashboard = ({ clusters }) => {
    if (!clusters || clusters.length === 0) {
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
            <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-white">Live Intelligence Feed</h2>
                <span className="bg-sky-500/20 text-sky-400 text-xs px-2 py-0.5 rounded-full border border-sky-500/30">
                    {clusters.length} Clusters Active
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clusters.map((cluster, idx) => (
                    <ClusterCard key={idx} cluster={cluster} index={idx} />
                ))}
            </div>
        </div>
    );
};

export default ResultsDashboard;
