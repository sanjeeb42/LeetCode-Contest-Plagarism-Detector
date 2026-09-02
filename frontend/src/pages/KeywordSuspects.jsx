import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, ShieldAlert, Key, Search, Plus, Trash2, Play, 
    Download, RefreshCw, Check, X, ExternalLink, AlertTriangle, 
    Loader2, Code2, Tag, ChevronDown, ChevronUp, Sparkles, FileSpreadsheet, Bot
} from 'lucide-react';
import ReplayViewer from '../components/ReplayViewer';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

function KeywordSuspects() {
    const { slug } = useParams();

    // Keywords management
    const [keywords, setKeywords] = useState([]);
    const [newKeywordInput, setNewKeywordInput] = useState('');
    const [savingKeywords, setSavingKeywords] = useState(false);

    // Results state
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedQuestionFilter, setSelectedQuestionFilter] = useState('All');
    
    // Scan task state
    const [scanProgress, setScanProgress] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    // Replay modal state
    const [viewingReplayFor, setViewingReplayFor] = useState(null);
    const [expandedUser, setExpandedUser] = useState(null);
    const [verifiedCheaters, setVerifiedCheaters] = useState({});

    // Fetch initial keywords and results
    const fetchKeywords = async () => {
        try {
            const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/contest_keywords?contest_slug=${slug}`);
            if (resp.data.keywords) {
                setKeywords(resp.data.keywords);
            }
        } catch (err) {
            console.error("Failed to load contest keywords:", err);
        }
    };

    const fetchResults = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/keyword_results?contest_slug=${slug}`);
            setData(resp.data);
            if (resp.data.keywords && resp.data.keywords.length > 0) {
                setKeywords(resp.data.keywords);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'No scan results found. Please configure keywords and run scan.');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchManualOverrides = async () => {
        try {
            const overridesResp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/manual_overrides?contest_slug=${slug}`);
            setVerifiedCheaters(overridesResp.data || {});
        } catch (err) {
            console.warn('Could not fetch manual overrides:', err);
        }
    };

    useEffect(() => {
        fetchKeywords();
        fetchResults();
        fetchManualOverrides();
    }, [slug]);

    // Poll task status during scan
    useEffect(() => {
        let interval;
        if (isScanning) {
            interval = setInterval(async () => {
                try {
                    const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/status?contest_slug=${slug}`);
                    const status = resp.data?.keyword_scan;
                    if (status) {
                        setScanProgress(status);
                        if (status.status === 'success' || status.status === 'error') {
                            setIsScanning(false);
                            fetchResults();
                            fetchManualOverrides();
                        }
                    }
                } catch (err) {
                    console.error("Failed to poll status:", err);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isScanning, slug]);

    // Add a keyword tag
    const handleAddKeyword = (e) => {
        e.preventDefault();
        const trimmed = newKeywordInput.trim();
        if (!trimmed) return;
        if (keywords.some(k => k.toLowerCase() === trimmed.toLowerCase())) {
            alert('Keyword already added!');
            return;
        }
        const updated = [...keywords, trimmed];
        setKeywords(updated);
        setNewKeywordInput('');
    };

    // Remove a keyword tag
    const handleRemoveKeyword = (kwToRemove) => {
        const updated = keywords.filter(k => k !== kwToRemove);
        setKeywords(updated);
    };

    // Save keywords and trigger replay scan
    const handleSaveAndScan = async () => {
        if (keywords.length === 0) {
            alert('Please add at least 1 keyword (e.g. "xasjbsd") before running the scan.');
            return;
        }

        setSavingKeywords(true);
        setIsScanning(true);
        setScanProgress({ status: 'running', message: 'Initializing keyword scan...', progress: 0 });

        try {
            // Save keywords
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/contest_keywords`, {
                contest_slug: slug,
                keywords: keywords
            });

            // Trigger scan
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/keyword_scan`, {
                contest_slug: slug,
                keywords: keywords,
                limit: 500,
                questions: ["Q1", "Q2", "Q3", "Q4"]
            });
        } catch (err) {
            console.error("Failed to trigger keyword scan:", err);
            alert(err.response?.data?.error || "Failed to start keyword scan.");
            setIsScanning(false);
        } finally {
            setSavingKeywords(false);
        }
    };

    // Toggle verified status
    const handleToggleVerified = async (e, username, currentStatus, newStatus) => {
        e.stopPropagation();
        setVerifiedCheaters(prev => {
            const updated = { ...prev };
            if (newStatus === undefined) delete updated[username];
            else updated[username] = newStatus;
            return updated;
        });

        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/override_ai`, {
                contest_slug: slug,
                username: username,
                is_ai: newStatus === undefined ? null : newStatus
            });
        } catch (err) {
            console.error("Failed to update status:", err);
        }
    };

    // Filter suspects
    const suspects = Array.isArray(data?.suspects) ? data.suspects : [];
    const filteredSuspects = suspects.filter(s => {
        if (!s) return false;
        const usernameStr = s.username || '';
        const kws = Array.isArray(s.matched_keywords) ? s.matched_keywords : [];

        const matchesQuery = searchQuery === '' || 
            usernameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
            kws.some(k => typeof k === 'string' && k.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesQuestion = selectedQuestionFilter === 'All' || 
            (s.questions && s.questions[selectedQuestionFilter]);

        return matchesQuery && matchesQuestion;
    });

    const handleExportCSV = () => {
        window.location.href = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/export_keyword_cheaters?contest_slug=${slug}`;
    };

    return (
        <div className="min-h-screen bg-transparent relative z-10 overflow-hidden font-sans text-gray-100 pb-20">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-red top-[-100px] right-[-100px]" />
            <div className="glow-amber bottom-[-100px] left-[-100px]" />

            {/* Header Navbar */}
            <header className="sticky top-0 z-50 glass-panel rounded-none border-t-0 border-x-0 border-b-white/10 shadow-none">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={`/contest/${slug}`} className="p-2.5 bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white active:scale-95">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <Key className="w-6 h-6 text-red-500" />
                            <div>
                                <h1 className="text-lg font-semibold text-white tracking-tight">Keyword <span className="text-red-400 font-normal">Cheating Detector</span></h1>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Contest: {slug}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation tabs for consistent UX */}
                    <div className="flex items-center gap-1.5 p-1 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md shrink-0">
                        <Link
                            to={`/contest/${slug}/ai-suspects`}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                        >
                            <Bot className="w-3.5 h-3.5 text-gray-400" />
                            <span>AI Suspects</span>
                        </Link>

                        <Link
                            to={`/contest/${slug}/keyword-suspects`}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                        >
                            <Key className="w-3.5 h-3.5 text-red-400" />
                            <span>Keyword Cheaters</span>
                        </Link>

                        <Link
                            to={`/contest/${slug}/batch-checker`}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />
                            <span>Batch Checker</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleExportCSV}
                            disabled={!data || data.total_flagged === 0}
                            className="btn-secondary py-1.5 !border-red-500/30 !text-red-400 hover:!bg-red-500/10 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export Cheaters</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
                {/* Title & Banner */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <div className="flex items-center gap-2 mb-2 text-red-400 font-medium text-xs tracking-widest uppercase">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Replay Watermark & Keyword Inspection</span>
                    </div>
                    <h2 className="text-3xl font-semibold text-white mb-2 tracking-tight">
                        Contest Secret Keywords ({slug})
                    </h2>
                    <p className="text-gray-400 text-sm max-w-3xl">
                        Define 2-4 keywords or watermark strings (e.g. <code className="text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded font-mono">xasjbsd</code>). The scanner inspects every user's entire raw typing replay stream. Anyone with a match is automatically flagged as **Cheating**.
                    </p>
                </motion.div>

                {/* Keyword Configuration Panel */}
                <div className="glass-panel p-6 mb-8 border border-white/10 bg-white/[0.02] rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-red-400" />
                            <h3 className="text-base font-semibold text-white">Contest Target Keywords (2-4 Words)</h3>
                        </div>
                        <span className="text-xs font-mono text-gray-400">{keywords.length} keyword(s) set</span>
                    </div>

                    {/* Tag input form */}
                    <form onSubmit={handleAddKeyword} className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder='Type a secret keyword (e.g. "xasjbsd") and press Enter...'
                                value={newKeywordInput}
                                onChange={(e) => setNewKeywordInput(e.target.value)}
                                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors font-mono"
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn-secondary py-2.5 px-4 text-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4 text-red-400" />
                            <span>Add Keyword</span>
                        </button>
                    </form>

                    {/* Active Keyword Chips */}
                    <div className="flex flex-wrap items-center gap-2.5 mb-6 min-h-[40px]">
                        {keywords.length === 0 ? (
                            <span className="text-xs italic text-gray-500 font-mono">No keywords configured yet for this contest. Add 2-4 words above.</span>
                        ) : (
                            keywords.map((kw, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 font-mono text-sm shadow-sm"
                                >
                                    <Key className="w-3.5 h-3.5 text-red-400" />
                                    <span>{kw}</span>
                                    <button
                                        onClick={() => handleRemoveKeyword(kw)}
                                        className="text-red-400/70 hover:text-red-200 transition-colors p-0.5"
                                        title="Remove Keyword"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))
                        )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div className="text-xs text-gray-400 font-mono flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>Replays checked: external pastes, typed buffers, comments & submission snapshots</span>
                        </div>
                        <button
                            onClick={handleSaveAndScan}
                            disabled={keywords.length === 0 || isScanning}
                            className="btn-primary bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-medium py-2.5 px-6 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span>Scanning Replays...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Save & Scan All Replays</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Progress Bar when scanning */}
                    {isScanning && scanProgress && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between text-xs font-mono text-gray-300 mb-2">
                                <span>{scanProgress.message || 'Scanning participants...'}</span>
                                <span>{scanProgress.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-red-500 to-amber-500 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${scanProgress.progress || 0}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Filter & Search Toolbar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search username or keyword..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-white/15 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono"
                            />
                        </div>

                        {/* Question Filter */}
                        <div className="flex items-center gap-1.5 bg-black/40 border border-white/15 rounded-lg p-1">
                            {['All', 'Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                                <button
                                    key={q}
                                    onClick={() => setSelectedQuestionFilter(q)}
                                    className={clsx(
                                        "px-3 py-1 rounded text-xs font-mono transition-colors",
                                        selectedQuestionFilter === q
                                            ? "bg-red-500/20 text-red-400 font-bold border border-red-500/30"
                                            : "text-gray-400 hover:text-white"
                                    )}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Counter Summary */}
                    {data && (
                        <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-gray-400">Total Scanned: <strong className="text-white">{data.total_scanned}</strong></span>
                            <span className="text-gray-400">Flagged Cheaters: <strong className="text-red-400">{data.total_flagged}</strong></span>
                        </div>
                    )}
                </div>

                {/* Content List Area */}
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
                        <p className="text-gray-400 font-mono text-sm">Loading keyword scan results...</p>
                    </div>
                ) : error ? (
                    <div className="glass-panel p-12 text-center border-red-500/20 bg-red-950/10">
                        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-white mb-1">{error}</h3>
                        <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                            Add your 2-4 secret keywords above and click <strong>"Save & Scan All Replays"</strong> to start scanning participants.
                        </p>
                    </div>
                ) : filteredSuspects.length === 0 ? (
                    <div className="glass-panel p-12 text-center">
                        <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-white mb-1">No Keyword Cheaters Found</h3>
                        <p className="text-gray-400 text-sm">
                            {suspects.length === 0 
                                ? "No participant's replay contained any of the target keywords." 
                                : "No results match your active search filter."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSuspects.map((suspect, idx) => {
                            const isExpanded = expandedUser === suspect.username;
                            const isVerified = verifiedCheaters[suspect.username] === true;

                            return (
                                <motion.div
                                    key={suspect.username}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className={clsx(
                                        "glass-panel border overflow-hidden transition-all duration-200",
                                        isVerified 
                                            ? "border-red-500/40 bg-red-950/20" 
                                            : "border-white/10 hover:border-white/20 bg-white/[0.01]"
                                    )}
                                >
                                    {/* Card Header */}
                                    <div className="p-5 flex items-center justify-between flex-wrap gap-4">
                                        <div className="flex items-center gap-4">
                                            {/* Rank Badge */}
                                            <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 font-mono text-sm font-bold text-gray-300">
                                                #{suspect.rank}
                                            </div>

                                            {/* User Details */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={`https://leetcode.com/u/${suspect.user_slug || suspect.username}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-base font-semibold text-white hover:text-red-400 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <span>{suspect.username}</span>
                                                        <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                                                    </a>

                                                    {/* Rating */}
                                                    {suspect.rating && suspect.rating !== "N/A" && (
                                                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                                                            {suspect.rating}
                                                        </span>
                                                    )}
                                                </div>

                                                    {/* Matched Keywords Badges */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs text-gray-400">Matched:</span>
                                                        {(suspect.matched_keywords || []).map((kw, i) => (
                                                            <span
                                                                key={i}
                                                                className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 font-mono text-xs font-bold animate-pulse"
                                                            >
                                                                "{kw}"
                                                            </span>
                                                        ))}
                                                    </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-3">
                                            {/* Flag Status */}
                                            <button
                                                onClick={(e) => handleToggleVerified(e, suspect.username, verifiedCheaters[suspect.username], isVerified ? undefined : true)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors border",
                                                    isVerified 
                                                        ? "bg-red-500 text-white border-red-400" 
                                                        : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                                )}
                                            >
                                                <ShieldAlert className="w-3.5 h-3.5" />
                                                <span>{isVerified ? "FLAGGED CHEATER" : "FLAG AS CHEATER"}</span>
                                            </button>

                                            {/* Toggle Match Snippets */}
                                            <button
                                                onClick={() => setExpandedUser(isExpanded ? null : suspect.username)}
                                                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                                            >
                                                <span>{isExpanded ? "Hide Matches" : "View Matches"}</span>
                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Match Snippets */}
                                    <AnimatePresence>
                                        {isExpanded && suspect.questions && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="border-t border-white/10 bg-black/40 p-5 space-y-4"
                                            >
                                                {Object.entries(suspect.questions).map(([qId, qData]) => (
                                                    <div key={qId} className="bg-white/[0.02] border border-white/10 rounded-lg p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs font-bold text-white">
                                                                    {qId}
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    Found {qData.matches?.length || 0} occurrence(s)
                                                                </span>
                                                            </div>

                                                            {/* View Replay Trigger */}
                                                            <button
                                                                onClick={() => setViewingReplayFor({
                                                                    questionId: qId,
                                                                    username: suspect.username,
                                                                    userSlug: suspect.user_slug
                                                                })}
                                                                className="btn-primary py-1 px-3 text-xs bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5"
                                                            >
                                                                <Play className="w-3 h-3 fill-current" />
                                                                <span>View Replay</span>
                                                            </button>
                                                        </div>

                                                        {/* Snippet Lines */}
                                                        <div className="space-y-2 font-mono text-xs">
                                                            {qData.matches?.map((m, mIdx) => (
                                                                <div key={mIdx} className="bg-black/60 p-3 rounded border border-white/10 flex items-start gap-3">
                                                                    <div className="shrink-0 flex flex-col items-end text-gray-500 select-none border-r border-white/10 pr-3">
                                                                        <span className="text-[10px] uppercase text-red-400">{m.event_type}</span>
                                                                        {m.line_number && <span>L:{m.line_number}</span>}
                                                                    </div>
                                                                    <div className="flex-1 overflow-x-auto text-gray-300">
                                                                        <span>Snippet: </span>
                                                                        <span className="text-red-300 bg-red-950/60 px-1 py-0.5 rounded border border-red-500/30">
                                                                            {m.snippet}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Interactive Replay Viewer Modal */}
            {viewingReplayFor && (
                <ReplayViewer
                    contestSlug={slug}
                    questionId={viewingReplayFor.questionId}
                    username={viewingReplayFor.username}
                    userSlug={viewingReplayFor.userSlug}
                    onClose={() => setViewingReplayFor(null)}
                />
            )}
        </div>
    );
}

export default KeywordSuspects;
