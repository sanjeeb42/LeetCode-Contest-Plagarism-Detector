import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ShieldAlert, Cpu, Loader2, AlertTriangle, CheckCircle, Eye, Play, ChevronDown, ChevronUp, ExternalLink, Filter, Search } from 'lucide-react';
import ReplayViewer from '../components/ReplayViewer';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

function AISuspects() {
    const { slug } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterFlagged, setFilterFlagged] = useState(false);
    const [sortBy, setSortBy] = useState('ai_score'); // 'ai_score' or 'rank'
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedUser, setExpandedUser] = useState(null);
    const [viewingReplayFor, setViewingReplayFor] = useState(null);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/top500_results?contest_slug=${slug}`);
                setData(resp.data);
            } catch (err) {
                setError(err.response?.data?.error || 'No scan results found. Run the Top 500 scan first.');
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [slug]);

    const getScoreColor = (score) => {
        if (score >= 60) return 'text-red-400';
        if (score >= 40) return 'text-amber-400';
        return 'text-emerald-400';
    };

    const getScoreBg = (score) => {
        if (score >= 60) return 'bg-red-500/10 border-red-500/20';
        if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
        return 'bg-emerald-500/10 border-emerald-500/20';
    };

    const getVerdict = (score) => {
        if (score >= 60) return { text: 'Likely AI', icon: AlertTriangle, color: 'text-red-400' };
        if (score >= 40) return { text: 'Suspicious', icon: Eye, color: 'text-amber-400' };
        return { text: 'Likely Human', icon: CheckCircle, color: 'text-emerald-400' };
    };

    const filteredSuspects = data?.suspects
        ?.filter(s => !filterFlagged || s.total_ai_score >= 60)
        ?.filter(s => !searchQuery || 
            s.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (s.user_slug && s.user_slug.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        ?.sort((a, b) => {
            if (sortBy === 'ai_score') return b.total_ai_score - a.total_ai_score;
            return a.rank - b.rank;
        }) || [];

    return (
        <div className="min-h-screen bg-transparent relative z-10 overflow-hidden">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-cyan top-[-100px] left-[-100px]" />
            <div className="glow-blue bottom-[-100px] right-[-100px]" />

            <header className="sticky top-0 z-50 glass-panel rounded-none border-t-0 border-x-0 border-b-white/10 shadow-none">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={`/contest/${slug}`} className="p-2 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-6 h-6 text-amber-400" />
                            <div>
                                <h1 className="text-lg font-semibold text-white tracking-tight">Top 500 <span className="text-amber-400">AI Suspects</span></h1>
                                <p className="text-xs text-gray-500 font-mono">{slug}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
                        <p className="text-gray-400 font-mono text-sm tracking-wide">Loading scan results...</p>
                    </div>
                ) : error ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center">
                        <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
                        <p className="text-gray-400 text-lg mb-2">{error}</p>
                        <Link to={`/contest/${slug}`} className="text-amber-400 hover:underline text-sm">
                            ← Back to Dashboard
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Summary Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
                        >
                            <div className="glass-panel rounded-xl p-6 border border-white/5">
                                <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Users Scanned</p>
                                <p className="text-3xl font-bold text-white">{data.total_scanned}</p>
                            </div>
                            <div className="glass-panel rounded-xl p-6 border border-red-500/10">
                                <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Flagged as AI</p>
                                <p className="text-3xl font-bold text-red-400">{data.total_flagged}</p>
                            </div>
                            <div className="glass-panel rounded-xl p-6 border border-white/5">
                                <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Questions Scanned</p>
                                <p className="text-3xl font-bold text-white">{data.questions_scanned?.join(', ')}</p>
                            </div>
                        </motion.div>

                        {/* Filters */}
                        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setFilterFlagged(!filterFlagged)}
                                    className={clsx(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                                        filterFlagged
                                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                                            : "bg-slate-800/50 border-white/10 text-gray-400 hover:border-white/20"
                                    )}
                                >
                                    <Filter className="w-4 h-4" />
                                    {filterFlagged ? 'Showing Flagged Only' : 'Show All Users'}
                                </button>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search username..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/50 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Sort by:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-slate-800 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none"
                                >
                                    <option value="ai_score">AI Score (High → Low)</option>
                                    <option value="rank">Contest Rank (Top → Bottom)</option>
                                </select>
                            </div>
                        </div>

                        {/* User Cards */}
                        <div className="space-y-4">
                            <AnimatePresence>
                                {filteredSuspects.map((suspect, idx) => {
                                    const verdict = getVerdict(suspect.total_ai_score);
                                    const VerdictIcon = verdict.icon;
                                    const isExpanded = expandedUser === suspect.username;

                                    return (
                                        <motion.div
                                            key={suspect.username}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="glass-panel rounded-xl border border-white/5 overflow-hidden"
                                        >
                                            {/* User Header Row */}
                                            <div
                                                className="p-5 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                                onClick={() => setExpandedUser(isExpanded ? null : suspect.username)}
                                            >
                                                {/* Rank Badge */}
                                                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-white font-bold text-sm border border-white/5 shrink-0">
                                                    #{suspect.rank}
                                                </div>

                                                {/* User Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-semibold truncate">{suspect.username}</span>
                                                        <span className="text-gray-500 text-xs truncate">@{suspect.user_slug}</span>
                                                        <a
                                                            href={`https://leetcode.com/u/${suspect.user_slug}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-gray-500 hover:text-white"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                    {/* Reason Tags */}
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {suspect.total_reasons.slice(0, 3).map((reason, i) => (
                                                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-gray-400 border border-white/5">
                                                                {reason}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* AI Score Badge */}
                                                <div className={clsx(
                                                    "px-4 py-2 rounded-xl border text-center shrink-0",
                                                    getScoreBg(suspect.total_ai_score)
                                                )}>
                                                    <p className={clsx("text-2xl font-bold", getScoreColor(suspect.total_ai_score))}>
                                                        {suspect.total_ai_score}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">AI Score</p>
                                                </div>

                                                {/* Verdict */}
                                                <div className={clsx("flex items-center gap-1 shrink-0", verdict.color)}>
                                                    <VerdictIcon className="w-4 h-4" />
                                                    <span className="text-xs font-semibold">{verdict.text}</span>
                                                </div>

                                                {/* Expand Toggle */}
                                                <div className="shrink-0 text-gray-500">
                                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-white/5"
                                                >
                                                    <div className="p-5 space-y-6">
                                                        {/* Per-Question Breakdown */}
                                                        {Object.entries(suspect.questions).map(([qId, qData]) => (
                                                            <div key={qId} className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-white font-semibold text-sm">{qId}</span>
                                                                        <span className={clsx(
                                                                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                                                                            getScoreBg(qData.ai_score),
                                                                            getScoreColor(qData.ai_score)
                                                                        )}>
                                                                            Score: {qData.ai_score}
                                                                        </span>
                                                                        {qData.paste_ratio > 0 && (
                                                                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-gray-300">
                                                                                {Math.round(qData.paste_ratio * 100)}% pasted
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setViewingReplayFor({ username: suspect.username, questionId: qId });
                                                                        }}
                                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-medium hover:bg-sky-500/20 transition-colors"
                                                                    >
                                                                        <Play className="w-3 h-3" />
                                                                        Watch Replay
                                                                    </button>
                                                                </div>

                                                                {/* Reasons */}
                                                                {qData.reasons.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mb-3">
                                                                        {qData.reasons.map((r, i) => (
                                                                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                                                                {r}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Paste Events */}
                                                                {qData.paste_events.length > 0 && (
                                                                    <div className="space-y-2 mb-3">
                                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Paste Events</p>
                                                                        {qData.paste_events.map((pe, i) => (
                                                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                                                <span className="text-gray-500 font-mono">{pe.chars} chars</span>
                                                                                {pe.has_comments && (
                                                                                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px]">Has Comments</span>
                                                                                )}
                                                                                {pe.has_ai_phrases && (
                                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px]">AI Phrases</span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Code Preview */}
                                                                {qData.final_code && (
                                                                    <details className="group">
                                                                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-white transition-colors select-none">
                                                                            View Final Code ▾
                                                                        </summary>
                                                                        <pre className="mt-2 p-3 bg-slate-900 rounded-lg border border-white/5 text-xs text-slate-300 font-mono overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                                                            {qData.final_code}
                                                                        </pre>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {filteredSuspects.length === 0 && (
                                <div className="py-16 text-center">
                                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                                    <p className="text-gray-400 text-lg">No suspects match the current filter.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {/* Replay Viewer Modal */}
            {viewingReplayFor && (
                <ReplayViewer
                    contestSlug={slug}
                    questionId={viewingReplayFor.questionId}
                    username={viewingReplayFor.username}
                    onClose={() => setViewingReplayFor(null)}
                />
            )}
        </div>
    );
}

export default AISuspects;
