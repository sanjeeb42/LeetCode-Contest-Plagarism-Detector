import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, ShieldAlert, Cpu, Loader2, AlertTriangle, CheckCircle, 
    Eye, Play, ChevronDown, ChevronUp, ExternalLink, Filter, Search, 
    RefreshCw, Check, X, Terminal, Copy, Code2, Users, ChevronRight 
} from 'lucide-react';
import ReplayViewer from '../components/ReplayViewer';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Simple heuristic detector for LeetCode final codes to display nice filenames
const detectLanguage = (code) => {
    if (!code) return { name: 'PlainText', ext: 'txt' };
    const codeSnippet = code.slice(0, 1000);
    if (codeSnippet.includes('def ') || (codeSnippet.includes('import ') && codeSnippet.includes(':'))) {
        return { name: 'Python', ext: 'py' };
    }
    if (codeSnippet.includes('#include') || codeSnippet.includes('std::') || codeSnippet.includes('vector<')) {
        return { name: 'C++', ext: 'cpp' };
    }
    if (codeSnippet.includes('public class Solution') || codeSnippet.includes('class Solution') && codeSnippet.includes('public ')) {
        return { name: 'Java', ext: 'java' };
    }
    if (codeSnippet.includes('function ') || codeSnippet.includes('const ') || codeSnippet.includes('let ') || codeSnippet.includes('var ')) {
        return { name: 'JavaScript', ext: 'js' };
    }
    if (codeSnippet.includes('impl Solution') || codeSnippet.includes('pub fn ')) {
        return { name: 'Rust', ext: 'rs' };
    }
    return { name: 'C++', ext: 'cpp' }; // default LeetCode fallback
};

function AISuspects() {
    const { slug } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [minAiScore, setMinAiScore] = useState(60);
    const [filterQuestion, setFilterQuestion] = useState('All');
    const [sortBy, setSortBy] = useState('ai_score'); // 'ai_score' or 'rank'
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedUser, setExpandedUser] = useState(null);
    const [viewingReplayFor, setViewingReplayFor] = useState(null);
    const [verifiedCheaters, setVerifiedCheaters] = useState({});
    
    // Custom states for CodeTerminal preview
    const [expandedCodes, setExpandedCodes] = useState({});
    const [copiedKey, setCopiedKey] = useState(null);

    const fetchResults = async (force = false) => {
        setLoading(true);
        setError(null);
        try {
            const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/top500_results?contest_slug=${slug}`);
            setData(resp.data);
            
            try {
                const overridesResp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/manual_overrides?contest_slug=${slug}`);
                setVerifiedCheaters(overridesResp.data || {});
            } catch (err) {
                console.warn('Could not fetch manual overrides', err);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'No scan results found. Run the Top 500 scan first.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
    }, [slug]);

    const handleToggleVerified = async (e, username, currentStatus, newStatus) => {
        e.stopPropagation();
        // Optimistic update
        setVerifiedCheaters(prev => {
            const updated = { ...prev };
            if (newStatus === undefined) {
                delete updated[username];
            } else {
                updated[username] = newStatus;
            }
            return updated;
        });
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/override_ai`, {
                contest_slug: slug,
                username: username,
                is_ai: newStatus === undefined ? null : newStatus
            });
        } catch (err) {
            console.error("Failed to update verification status", err);
            // Revert on failure
            setVerifiedCheaters(prev => {
                const reverted = { ...prev };
                if (currentStatus === undefined) {
                    delete reverted[username];
                } else {
                    reverted[username] = currentStatus;
                }
                return reverted;
            });
        }
    };

    const handleExportAI = () => {
        window.location.href = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/export_ai_cheaters?contest_slug=${slug}`;
    };

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

    const toggleCodeExpand = (key) => {
        setExpandedCodes(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleCopyCode = (code, key) => {
        navigator.clipboard.writeText(code);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const filteredSuspects = data?.suspects
        ?.filter(s => {
            if (filterQuestion === 'All') return s.total_ai_score >= minAiScore;
            return s.questions && s.questions[filterQuestion] && s.questions[filterQuestion].ai_score >= minAiScore;
        })
        ?.filter(s => !searchQuery || 
            s.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (s.user_slug && s.user_slug.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        ?.sort((a, b) => {
            if (sortBy === 'ai_score') return b.total_ai_score - a.total_ai_score;
            return a.rank - b.rank;
        }) || [];

    return (
        <div className="min-h-screen bg-transparent relative z-10 overflow-hidden pb-20">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-cyan top-[-100px] left-[-100px]" />
            <div className="glow-blue bottom-[-100px] right-[-100px]" />

            {/* Revamped Premium Header */}
            <header className="sticky top-0 z-50 bg-[#0f0e0d]/80 backdrop-blur-md border-b border-amber-500/10 shadow-lg select-none">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link 
                            to={`/contest/${slug}`} 
                            className="p-2.5 bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3.5">
                            <div className="relative">
                                <ShieldAlert className="w-8 h-8 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse" />
                                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f0e0d]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-black text-white tracking-tight">
                                        Top 500 <span className="text-amber-500 text-glow">AI Suspects</span>
                                    </h1>
                                    <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-[9px] font-mono font-bold text-red-400 rounded-full tracking-wider uppercase">
                                        AI Audit
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">Contest: {slug}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
                        <p className="text-gray-400 font-mono text-sm tracking-wide">Analyzing plagiarism metadata...</p>
                    </div>
                ) : error ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center">
                        <AlertTriangle className="w-10 h-10 text-amber-500 mb-4" />
                        <p className="text-gray-300 text-lg mb-4">{error}</p>
                        <Link 
                            to={`/contest/${slug}`} 
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black rounded-xl text-sm font-bold transition-all duration-300"
                        >
                            ← Back to Contest Dashboard
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Revamped Summary Stats Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
                        >
                            {/* Card 1: Users Scanned */}
                            <div className="glass-panel p-6 border border-white/5 hover:-translate-y-1 hover:shadow-2xl hover:border-amber-500/20 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-500 pointer-events-none" />
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Users Scanned</p>
                                        <p className="text-4xl font-extrabold text-white tracking-tight">{data.total_scanned}</p>
                                    </div>
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shadow-[0_0_15px_rgba(255,161,22,0.1)] group-hover:scale-110 transition-transform duration-300">
                                        <Users className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Flagged as AI */}
                            <div className="glass-panel p-6 border border-red-500/20 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(239,68,68,0.1)] hover:border-red-500/30 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-500 pointer-events-none" />
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Flagged as AI</p>
                                        <p className="text-4xl font-extrabold text-red-400 tracking-tight">{data.total_flagged}</p>
                                    </div>
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 animate-pulse group-hover:scale-110 transition-transform duration-300">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Questions Scanned */}
                            <div className="glass-panel p-6 border border-purple-500/20 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(168,85,247,0.1)] hover:border-purple-500/30 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-500 pointer-events-none" />
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1.5">Questions Scanned</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {data.questions_scanned?.map((q, idx) => (
                                                <span key={idx} className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded text-xs font-mono">
                                                    {q}
                                                </span>
                                            )) || 'None'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                        <Code2 className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Control Center */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel p-5 mb-8 border border-white/5 flex flex-wrap items-center justify-between gap-4"
                        >
                            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                {/* Export Button */}
                                <button
                                    onClick={handleExportAI}
                                    title="Export AI Cheaters"
                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 text-sm font-bold text-red-400 hover:text-white rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] active:scale-95 cursor-pointer"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Export AI Cheaters</span>
                                </button>

                                {/* Refresh Button */}
                                <button
                                    onClick={() => fetchResults(true)}
                                    title="Refresh Data"
                                    className="flex items-center justify-center p-2.5 bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-white/20 rounded-xl text-gray-400 hover:text-white transition-all duration-300 active:scale-95 group cursor-pointer"
                                >
                                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                </button>

                                <div className="h-6 w-px bg-white/10 hidden md:block" />

                                {/* Search Input */}
                                <div className="relative flex-1 min-w-[200px] max-w-xs group">
                                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search username or slug..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-slate-950 border border-white/5 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-all duration-300 shadow-inner font-sans"
                                    />
                                </div>

                                {/* Min AI Score Slider */}
                                <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/30 hover:bg-slate-900/50 border border-white/5 rounded-xl transition-colors duration-300">
                                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-xs text-gray-400 select-none">Min Score:</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={minAiScore}
                                        onChange={(e) => setMinAiScore(Number(e.target.value))}
                                        className="w-20 md:w-28 accent-amber-500 bg-slate-800 h-1 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="text-xs font-mono font-bold text-amber-400 w-6 text-right">{minAiScore}</span>
                                </div>

                                {/* Question Selector */}
                                {data?.questions_scanned && data.questions_scanned.length > 0 && (
                                    <select
                                        value={filterQuestion}
                                        onChange={(e) => setFilterQuestion(e.target.value)}
                                        className="bg-slate-900/50 hover:bg-slate-900/80 border border-white/5 hover:border-white/20 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-amber-500/50 transition-all duration-300 cursor-pointer"
                                    >
                                        <option value="All">All Questions</option>
                                        {data.questions_scanned.map(q => (
                                            <option key={q} value={q}>{q}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Sort Options */}
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-500 select-none">Sort by</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-slate-900/50 hover:bg-slate-900/80 border border-white/5 hover:border-white/20 text-gray-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-500/50 transition-all duration-300 cursor-pointer"
                                >
                                    <option value="ai_score">AI Score (High → Low)</option>
                                    <option value="rank">Contest Rank (Top → Bottom)</option>
                                </select>
                            </div>
                        </motion.div>

                        {/* User Cards List */}
                        <div className="space-y-4">
                            <AnimatePresence>
                                {filteredSuspects.map((suspect, idx) => {
                                    const verdict = getVerdict(suspect.total_ai_score);
                                    const VerdictIcon = verdict.icon;
                                    const isExpanded = expandedUser === suspect.username;
                                    const userKey = suspect.user_slug || suspect.username;

                                    return (
                                        <motion.div
                                            key={suspect.username}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: idx * 0.015 }}
                                            className="glass-card rounded-2xl border border-white/5 hover:border-amber-500/20 hover:bg-[#1a1714]/40 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] duration-300 transition-all overflow-hidden"
                                        >
                                            {/* User Header Row */}
                                            <div
                                                className="p-5 flex flex-wrap md:flex-nowrap items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                                onClick={() => setExpandedUser(isExpanded ? null : suspect.username)}
                                            >
                                                {/* Verification Checkbox */}
                                                <div 
                                                    className="shrink-0 flex items-center justify-center p-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const currentStatus = verifiedCheaters[userKey];
                                                        
                                                        // Cycle status: undefined -> true (Cheated, Red) -> false (Not Cheating, Green) -> undefined (No Review, Gray)
                                                        let newStatus;
                                                        if (currentStatus === undefined) {
                                                            newStatus = true;
                                                        } else if (currentStatus === true) {
                                                            newStatus = false;
                                                        } else {
                                                            newStatus = undefined;
                                                        }
                                                        
                                                        handleToggleVerified(e, userKey, currentStatus, newStatus);
                                                    }}
                                                >
                                                    <div className="relative group/checkbox cursor-pointer select-none">
                                                        {verifiedCheaters[userKey] === true ? (
                                                            // Red State: Cheated (Red border/bg with Check/X-mark style)
                                                            <div className="w-5 h-5 rounded-md border border-red-500 bg-red-500/10 text-red-400 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:bg-red-500/20 active:scale-90 transition-all duration-150">
                                                                <X className="w-3.5 h-3.5 stroke-[3]" />
                                                            </div>
                                                        ) : verifiedCheaters[userKey] === false ? (
                                                            // Green State: Verified Human (Not Cheating) (Green border/bg with check)
                                                            <div className="w-5 h-5 rounded-md border border-emerald-500 bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500/20 active:scale-90 transition-all duration-150">
                                                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                            </div>
                                                        ) : (
                                                            // Empty State: No manual review (clean empty outline box)
                                                            <div className="w-5 h-5 rounded-md border-2 border-gray-600 hover:border-gray-400 active:scale-90 transition-all duration-150" />
                                                        )}
                                                        
                                                        {/* Premium Custom Tooltip */}
                                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-slate-950/95 backdrop-blur-md text-[10px] font-sans font-medium text-gray-200 px-3 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover/checkbox:opacity-100 transition-all duration-150 scale-95 group-hover/checkbox:scale-100 whitespace-nowrap pointer-events-none z-50 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] flex flex-col items-center">
                                                            <span className="font-semibold text-white">
                                                                {verifiedCheaters[userKey] === true 
                                                                    ? "Manual Flag: Cheated" 
                                                                    : verifiedCheaters[userKey] === false 
                                                                        ? "Manual Flag: Not Cheated" 
                                                                        : "Unreviewed"}
                                                            </span>
                                                            <span className="text-[9px] text-gray-400 font-normal mt-0.5">
                                                                {verifiedCheaters[userKey] === true 
                                                                    ? "Click to mark Safe" 
                                                                    : verifiedCheaters[userKey] === false 
                                                                        ? "Click to clear review" 
                                                                        : "Click to flag Cheater"}
                                                            </span>
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-950 border-r border-b border-white/10 rotate-45 -mt-[4px]" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Rank Badge */}
                                                {(() => {
                                                    let rankStyle = "border-white/5 bg-slate-900/50 text-gray-400";
                                                    let glowShadow = "";
                                                    if (suspect.rank === 1) {
                                                        rankStyle = "border-[#ffd700]/30 bg-[#ffd700]/5 text-[#ffd700] font-extrabold";
                                                        glowShadow = "shadow-[0_0_12px_rgba(255,215,0,0.15)]";
                                                    } else if (suspect.rank === 2) {
                                                        rankStyle = "border-[#c0c0c0]/30 bg-[#c0c0c0]/5 text-[#c0c0c0] font-bold";
                                                        glowShadow = "shadow-[0_0_12px_rgba(192,192,192,0.15)]";
                                                    } else if (suspect.rank === 3) {
                                                        rankStyle = "border-[#cd7f32]/30 bg-[#cd7f32]/5 text-[#cd7f32] font-bold";
                                                        glowShadow = "shadow-[0_0_12px_rgba(205,127,50,0.15)]";
                                                    }
                                                    return (
                                                        <div className={clsx(
                                                            "w-12 h-12 rounded-xl border flex items-center justify-center text-xs font-mono shrink-0 transition-all duration-300",
                                                            rankStyle,
                                                            glowShadow
                                                        )}>
                                                            #{suspect.rank}
                                                        </div>
                                                    );
                                                })()}

                                                {/* User Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-bold text-base hover:text-[#FFA116] transition-colors truncate">{suspect.username}</span>
                                                        <span className="text-gray-500 text-xs truncate font-mono">@{suspect.user_slug}</span>
                                                        <a
                                                            href={`https://leetcode.com/u/${suspect.user_slug}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-gray-500 hover:text-white p-1 hover:bg-white/5 rounded transition-all mr-0.5"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                        {suspect.rating && suspect.rating !== "N/A" && suspect.rating !== "0" && (
                                                            <>
                                                                <span className="px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono font-bold text-[#FFA116] rounded-md select-none" title="LeetCode Current Rating">
                                                                    {suspect.rating}
                                                                </span>
                                                                {suspect.attended !== undefined && suspect.attended !== null && suspect.attended !== 0 && (
                                                                    <span className="px-1.5 py-0.5 bg-slate-500/15 border border-slate-500/30 text-[10px] font-mono font-bold text-slate-300 rounded-md select-none" title="Contests Attended">
                                                                        {suspect.attended} contests
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    {/* Reason Tags */}
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {suspect.total_reasons.slice(0, 3).map((reason, i) => {
                                                            let badgeStyle = "bg-slate-900/60 text-gray-400 border-white/5";
                                                            if (reason.toLowerCase().includes('paste')) {
                                                                badgeStyle = "bg-amber-500/5 text-amber-400/90 border-amber-500/10";
                                                            } else if (reason.toLowerCase().includes('comment') || reason.toLowerCase().includes('plagiarism')) {
                                                                badgeStyle = "bg-red-500/5 text-red-400/90 border-red-500/10";
                                                            }
                                                            return (
                                                                <span key={i} className={clsx(
                                                                    "text-[10px] font-mono px-2.5 py-0.5 rounded-md border select-none",
                                                                    badgeStyle
                                                                )}>
                                                                    {reason}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* AI Score Badge */}
                                                <div className={clsx(
                                                    "px-4 py-2 rounded-xl border text-center shrink-0 transition-all duration-300 hover:scale-105",
                                                    getScoreBg(suspect.total_ai_score)
                                                )}>
                                                    <p className={clsx("text-2xl font-black font-mono tracking-tight", getScoreColor(suspect.total_ai_score))}>
                                                        {suspect.total_ai_score}%
                                                    </p>
                                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">AI Score</p>
                                                </div>

                                                {/* Verdict Badge */}
                                                {(() => {
                                                    let verdictStyle = "";
                                                    if (suspect.total_ai_score >= 60) {
                                                        verdictStyle = "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)]";
                                                    } else if (suspect.total_ai_score >= 40) {
                                                        verdictStyle = "bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]";
                                                    } else {
                                                        verdictStyle = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                                                    }
                                                    return (
                                                        <div className={clsx(
                                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shrink-0 select-none",
                                                            verdictStyle
                                                        )}>
                                                            <VerdictIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                                            <span>{verdict.text}</span>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Expand Toggle Chevron */}
                                                <div className="shrink-0 text-gray-500 p-1 hover:bg-white/5 rounded-lg transition-colors">
                                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="border-t border-white/5 bg-slate-950/20"
                                                >
                                                    <div className="p-6 space-y-6">
                                                        {/* Per-Question Breakdown */}
                                                        {Object.entries(suspect.questions).map(([qId, qData]) => (
                                                            <div key={qId} className="bg-slate-900/60 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all duration-300 shadow-lg">
                                                                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-white font-bold text-sm tracking-wide">{qId}</span>
                                                                        <span className={clsx(
                                                                            "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border",
                                                                            getScoreBg(qData.ai_score),
                                                                            getScoreColor(qData.ai_score)
                                                                        )}>
                                                                            AI Score: {qData.ai_score}%
                                                                        </span>
                                                                        {qData.paste_ratio > 0 && (
                                                                            <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-white/5">
                                                                                {Math.round(qData.paste_ratio * 100)}% pasted
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setViewingReplayFor({ username: suspect.username, userSlug: suspect.user_slug || suspect.username, questionId: qId });
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/20 hover:border-sky-500 text-xs font-bold transition-all duration-300 shadow-[0_0_15px_rgba(14,165,233,0.05)] hover:shadow-[0_0_20px_rgba(14,165,233,0.2)] cursor-pointer active:scale-95"
                                                                    >
                                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                                        <span>Watch Replay</span>
                                                                    </button>
                                                                </div>

                                                                {/* Reasons */}
                                                                {qData.reasons.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                                                        {qData.reasons.map((r, i) => (
                                                                            <span key={i} className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-red-500/5 text-red-400 border border-red-500/10">
                                                                                {r}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Paste Events / Clipboard Logs */}
                                                                {qData.paste_events.length > 0 && (
                                                                    <div className="space-y-2 mb-4 bg-slate-950/40 p-4 rounded-xl border border-white/[0.03]">
                                                                        <div className="flex items-center justify-between mb-1.5">
                                                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-sans">Clipboard Logs</span>
                                                                            <span className="text-[9px] text-gray-500 font-mono">{qData.paste_events.length} paste{qData.paste_events.length > 1 ? 's' : ''} detected</span>
                                                                        </div>
                                                                        <div className="grid gap-2">
                                                                            {qData.paste_events.map((pe, i) => (
                                                                                <div key={i} className="flex items-center justify-between bg-slate-900/40 border border-white/5 rounded-lg p-2 text-xs">
                                                                                    <div className="flex items-center gap-2.5">
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                                                                        <span className="text-gray-300 font-medium">Pasted <span className="font-mono text-amber-400 font-bold">{pe.chars}</span> characters</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        {pe.has_comments && (
                                                                                            <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-semibold select-none flex items-center gap-0.5">
                                                                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                                                                Comments Detected
                                                                                            </span>
                                                                                        )}
                                                                                        {pe.has_ai_phrases && (
                                                                                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-semibold select-none flex items-center gap-0.5">
                                                                                                <ShieldAlert className="w-2.5 h-2.5" />
                                                                                                AI Boilerplate
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Code Preview Terminal */}
                                                                {qData.final_code && (
                                                                    <div className="mt-2">
                                                                        {(() => {
                                                                            const codeKey = `${suspect.username}-${qId}`;
                                                                            const isCodeExpanded = expandedCodes[codeKey];
                                                                            return (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => toggleCodeExpand(codeKey)}
                                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-xs font-mono text-gray-400 hover:text-white transition-all duration-200 select-none cursor-pointer"
                                                                                    >
                                                                                        <Terminal className="w-3.5 h-3.5" />
                                                                                        <span>{isCodeExpanded ? 'Hide' : 'View'} Final Submission Code</span>
                                                                                        <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform duration-200", isCodeExpanded && "rotate-90")} />
                                                                                    </button>
                                                                                    <AnimatePresence>
                                                                                        {isCodeExpanded && (
                                                                                            <motion.div
                                                                                                initial={{ opacity: 0, height: 0 }}
                                                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                                                exit={{ opacity: 0, height: 0 }}
                                                                                                transition={{ duration: 0.25 }}
                                                                                                className="overflow-hidden mt-3"
                                                                                            >
                                                                                                {(() => {
                                                                                                    const langInfo = detectLanguage(qData.final_code);
                                                                                                    const isCopied = copiedKey === codeKey;
                                                                                                    return (
                                                                                                        <div className="bg-[#0b0c10] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                                                                                                            {/* Terminal Header */}
                                                                                                            <div className="bg-[#12131a] px-4 py-2.5 flex items-center justify-between border-b border-white/5 select-none">
                                                                                                                <div className="flex items-center gap-2">
                                                                                                                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                                                                                                                    <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                                                                                                                    <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                                                                                                                </div>
                                                                                                                <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
                                                                                                                    <Terminal className="w-3.5 h-3.5" />
                                                                                                                    <span>solution.{langInfo.ext} ({langInfo.name})</span>
                                                                                                                </div>
                                                                                                                <button
                                                                                                                    onClick={() => handleCopyCode(qData.final_code, codeKey)}
                                                                                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-gray-400 hover:text-white border border-white/5 transition-all text-[10px] font-mono font-medium active:scale-95 cursor-pointer"
                                                                                                                >
                                                                                                                    {isCopied ? (
                                                                                                                        <>
                                                                                                                            <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                                                                                                                            <span className="text-emerald-400">Copied!</span>
                                                                                                                        </>
                                                                                                                    ) : (
                                                                                                                        <>
                                                                                                                            <Copy className="w-3 h-3" />
                                                                                                                            <span>Copy Code</span>
                                                                                                                        </>
                                                                                                                    )}
                                                                                                                </button>
                                                                                                            </div>
                                                                                                            
                                                                                                            {/* Code Window with line numbers */}
                                                                                                            <div className="flex font-mono text-xs overflow-x-auto max-h-85 overflow-y-auto custom-scrollbar select-text bg-[#0b0c10]">
                                                                                                                {/* Line Numbers Column */}
                                                                                                                <div className="select-none text-right pr-3.5 text-gray-600 border-r border-white/5 bg-slate-950/45 px-3 py-3 font-mono leading-relaxed min-w-[3.5rem]">
                                                                                                                    {qData.final_code.split('\n').map((_, index) => (
                                                                                                                        <div key={index} className="h-5 flex items-center justify-end">{index + 1}</div>
                                                                                                                    ))}
                                                                                                                </div>
                                                                                                                {/* Actual Code Line-by-line */}
                                                                                                                <pre className="flex-1 p-3 text-slate-300 font-mono leading-relaxed whitespace-pre overflow-x-auto selection:bg-amber-500/20 selection:text-white">
                                                                                                                    {qData.final_code.split('\n').map((line, i) => (
                                                                                                                        <div key={i} className="h-5 flex items-center">{line || ' '}</div>
                                                                                                                    ))}
                                                                                                                </pre>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    );
                                                                                                })()}
                                                                                            </motion.div>
                                                                                        )}
                                                                                    </AnimatePresence>
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>
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
                                <div className="py-20 text-center glass-panel border-white/5">
                                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                                    <p className="text-gray-300 text-lg font-semibold">Clean Sheet</p>
                                    <p className="text-gray-500 text-sm mt-1">No suspects match the current filters or score threshold.</p>
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
                    userSlug={viewingReplayFor.userSlug || viewingReplayFor.username}
                    onClose={() => setViewingReplayFor(null)}
                />
            )}
        </div>
    );
}

export default AISuspects;
