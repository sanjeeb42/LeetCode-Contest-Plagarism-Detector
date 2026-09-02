import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, ShieldAlert, Cpu, Loader2, AlertTriangle, CheckCircle, 
    Download, FileSpreadsheet, FileUp, RefreshCw, Check, X, Search, Bot, Key, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

function BatchChecker() {
    const { slug } = useParams();
    const [file, setFile] = useState(null);
    const [threshold, setThreshold] = useState(60);
    const [headers, setHeaders] = useState([]);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Drag & drop state
    const [dragActive, setDragActive] = useState(false);

    // Handle CSV file selection and client-side header parsing
    const handleFileChange = (selectedFile) => {
        if (!selectedFile) return;
        if (!selectedFile.name.endsWith('.csv')) {
            setError("Please upload a valid CSV file (.csv)");
            return;
        }
        setError(null);
        setFile(selectedFile);
        setResults(null);

        // Parse headers client-side
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (!allLines.length) {
                    setError("The uploaded CSV file is empty");
                    return;
                }
                const firstLine = allLines[0];
                const hasComma = firstLine.includes(',');
                
                // Check if first line looks like a header
                const headerKeywords = ["user_slug", "userslug", "username", "user", "handle", "name", "candidate", "participant", "rank", "rating", "score", "email"];
                let isHeader = false;
                
                if (hasComma) {
                    const fields = firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
                    isHeader = fields.some(f => {
                        const clean = f.toLowerCase().replace(/[\s_-]/g, '');
                        return headerKeywords.some(kw => clean.includes(kw));
                    });
                    if (isHeader) {
                        setHeaders(fields);
                    } else {
                        // No header - synthesize column names
                        const synthHeaders = fields.map((_, i) => `Column_${i + 1}`);
                        setHeaders(synthHeaders);
                    }
                } else {
                    // Single-column file (plain list of usernames)
                    const cleanFirst = firstLine.toLowerCase().replace(/[\s_-]/g, '');
                    isHeader = headerKeywords.some(kw => cleanFirst.includes(kw));
                    if (isHeader) {
                        setHeaders([firstLine.trim().replace(/^["']|["']$/g, '')]);
                    } else {
                        setHeaders(["user_slug"]);
                    }
                }
                
                // Smart auto-detection of user_slug / username column
                const parsedHeaders = headers.length > 0 ? headers : ["user_slug"];
                const candidates = ["user_slug", "userslug", "username", "user", "handle", "name"];
                let foundCol = null;
                
                // We need to use the headers we just set, but setState is async
                // So we use the local variable instead
                const localHeaders = hasComma 
                    ? (isHeader 
                        ? firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
                        : firstLine.split(',').map((_, i) => `Column_${i + 1}`))
                    : (isHeader 
                        ? [firstLine.trim().replace(/^["']|["']$/g, '')]
                        : ["user_slug"]);
                
                foundCol = localHeaders.find(h => {
                    const clean = h.toLowerCase().replace(/[\s_-]/g, '');
                    return candidates.includes(clean);
                });
                
                if (!foundCol) {
                    foundCol = localHeaders.find(h => {
                        const clean = h.toLowerCase().replace(/[\s_-]/g, '');
                        return candidates.some(c => clean.includes(c));
                    });
                }

                setHeaders(localHeaders);
                setSelectedColumn(foundCol || localHeaders[0] || '');
            } catch (err) {
                console.error("Error reading headers:", err);
                setError("Failed to read CSV headers. Please ensure the file is formatted correctly.");
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    // Trigger analysis
    const runBatchChecker = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("contest_slug", slug);
        formData.append("threshold", threshold);
        formData.append("username_column", selectedColumn);

        try {
            const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/batch_check_ai`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setResults(resp.data);
        } catch (err) {
            console.error("Batch check failed:", err);
            setError(err.response?.data?.error || "Failed to process the CSV file. Ensure you have run the Top 500 AI Scan first.");
        } finally {
            setLoading(false);
        }
    };

    // Download updated sheet
    const handleDownload = () => {
        if (!results || !results.csv_data) return;
        const blob = new Blob([results.csv_data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ai_checked_${slug}_threshold_${threshold}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetChecker = () => {
        setFile(null);
        setHeaders([]);
        setSelectedColumn('');
        setResults(null);
        setError(null);
    };

    // Filter preview records
    const filteredPreview = results?.preview?.filter(row => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (row.username && row.username.toLowerCase().includes(query)) ||
               (row.is_ai && row.is_ai.toLowerCase() === query) ||
               (row.score && String(row.score).includes(query));
    }) || [];

    return (
        <div className="min-h-screen bg-transparent relative z-10 overflow-hidden pb-20">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-cyan top-[-100px] left-[-100px]" />
            <div className="glow-blue bottom-[-100px] right-[-100px]" />

            {/* Premium Header */}
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
                                <FileSpreadsheet className="w-8 h-8 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
                                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-500 rounded-full border-2 border-[#0f0e0d]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-black text-white tracking-tight">
                                        AI <span className="text-amber-500 text-glow">Batch Checker</span>
                                    </h1>
                                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono font-bold text-amber-400 rounded-full tracking-wider uppercase">
                                        Data Audit
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">Contest: {slug}</p>
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
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                        >
                            <Key className="w-3.5 h-3.5 text-gray-400" />
                            <span>Keyword Cheaters</span>
                        </Link>

                        <Link
                            to={`/contest/${slug}/batch-checker`}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-pulse"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                            <span>Batch Checker</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
                    >
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>{error}</div>
                    </motion.div>
                )}

                {/* Upload & Setup Phase */}
                {!results && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                        {/* Drag and Drop Zone Card */}
                        <div className="lg:col-span-2">
                            <div 
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                className={clsx(
                                    "glass-panel min-h-[350px] p-8 flex flex-col items-center justify-center text-center border border-dashed transition-all duration-300 relative group cursor-pointer",
                                    dragActive ? "border-amber-500 bg-amber-500/5 shadow-[0_0_30px_rgba(255,161,22,0.1)]" : "border-white/10 hover:border-amber-500/40 hover:bg-[#141210]/20"
                                )}
                            >
                                <input 
                                    type="file" 
                                    id="csv-upload-input" 
                                    accept=".csv"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => handleFileChange(e.target.files[0])}
                                />
                                
                                <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 mb-5 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(255,161,22,0.05)]">
                                    <FileUp className="w-10 h-10" />
                                </div>
                                
                                {file ? (
                                    <>
                                        <h3 className="text-xl font-bold text-white mb-2">{file.name}</h3>
                                        <p className="text-sm text-gray-400 font-mono">{(file.size / 1024).toFixed(2)} KB</p>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); resetChecker(); }} 
                                            className="mt-5 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl"
                                        >
                                            Remove File
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-xl font-bold text-white mb-2">Upload User List Sheet</h3>
                                        <p className="text-sm text-gray-400 mb-6 max-w-md">
                                            Drag and drop your contest sheet (.csv) here, or click to browse files. The list should contain a column with LeetCode usernames or user slugs.
                                        </p>
                                        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-gray-400">
                                            Supports CSV file format
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Configuration Controls Card */}
                        <div className="glass-panel p-6 border border-white/5 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-amber-500" />
                                    <span>Analysis Parameters</span>
                                </h3>
                                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                                    Define the minimum AI Match score threshold and mapping columns before verifying the list.
                                </p>

                                {/* Confidence Score Slider */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-mono text-gray-400 uppercase tracking-wider font-bold">AI Score Threshold (X)</label>
                                        <span className="px-2 py-0.5 bg-amber-500/25 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold rounded">
                                            {threshold}%
                                        </span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="10" 
                                        max="100" 
                                        value={threshold} 
                                        onChange={(e) => setThreshold(parseInt(e.target.value))}
                                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-colors"
                                    />
                                    <span className="text-[10px] text-gray-500 block mt-1.5 leading-snug">
                                        Users with computed AI scores greater than or equal to this threshold will be flagged as <span className="text-red-400">Yes</span>.
                                    </span>
                                </div>

                                {/* Username Column Selector */}
                                <div className="mb-6">
                                    <label className="text-xs font-mono text-gray-400 uppercase tracking-wider font-bold block mb-2">Username Column (user_slug)</label>
                                    {file ? (
                                        <select
                                            value={selectedColumn}
                                            onChange={(e) => setSelectedColumn(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-black/60 border border-white/10 hover:border-white/20 focus:border-amber-500 text-sm font-semibold rounded-xl text-white outline-none cursor-pointer transition-all"
                                        >
                                            {headers.map((h, idx) => (
                                                <option key={idx} value={h} className="bg-[#0f0e0d] text-white">
                                                    {h}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="w-full px-3.5 py-2.5 bg-white/5 border border-white/5 text-gray-500 text-xs font-mono rounded-xl">
                                            Select a file to list columns
                                        </div>
                                    )}
                                    <span className="text-[10px] text-gray-500 block mt-1.5 leading-snug">
                                        Select the column representing the LeetCode User Slug or Username. We auto-detect this column upon upload.
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={runBatchChecker}
                                disabled={!file}
                                className={clsx(
                                    "w-full py-3 font-bold text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 mt-6 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(255,161,22,0.15)]",
                                    file 
                                        ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold shadow-lg" 
                                        : "bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed"
                                )}
                            >
                                <Cpu className="w-4 h-4 stroke-[2.5]" />
                                <span>Check AI Scores</span>
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Loading Status Terminal Screen */}
                {loading && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-panel p-12 min-h-[400px] flex flex-col items-center justify-center text-center border border-white/5"
                    >
                        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Analyzing List Metadata</h3>
                        <p className="text-sm text-gray-400 max-w-sm font-mono tracking-wide leading-relaxed">
                            Cross-referencing file usernames against pre-computed AI logs. Checking threshold scores...
                        </p>
                    </motion.div>
                )}

                {/* Results Screen */}
                {results && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Card 1: Total Rows */}
                            <div className="glass-panel p-6 border border-white/5 hover:-translate-y-1 hover:shadow-2xl hover:border-amber-500/20 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-500 pointer-events-none" />
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Total Users Processed</p>
                                        <p className="text-4xl font-extrabold text-white tracking-tight">{results.total_rows}</p>
                                    </div>
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 group-hover:scale-110 transition-transform duration-300">
                                        <Users className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Flagged AI Yes */}
                            <div className="glass-panel p-6 border border-red-500/20 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(239,68,68,0.1)] hover:border-red-500/30 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-500 pointer-events-none" />
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Flagged as AI (Yes)</p>
                                        <p className="text-4xl font-extrabold text-red-400 tracking-tight">{results.yes_count}</p>
                                    </div>
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 group-hover:scale-110 transition-transform duration-300">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Safe No */}
                            <div className="glass-panel p-6 border border-emerald-500/20 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)] hover:border-emerald-500/30 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500 pointer-events-none" />
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Below Threshold (No)</p>
                                        <p className="text-4xl font-extrabold text-emerald-400 tracking-tight">{results.no_count}</p>
                                    </div>
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Controls Panel */}
                        <div className="glass-panel p-5 mb-8 border border-white/5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                                {/* Search Preview Input */}
                                <div className="relative flex-1 max-w-sm min-w-[200px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search preview rows..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 hover:border-white/20 focus:border-amber-500 text-sm font-semibold rounded-xl text-white placeholder-gray-500 outline-none transition-all duration-300 focus:shadow-[0_0_15px_rgba(255,161,22,0.1)]"
                                    />
                                </div>

                                <div className="text-xs text-gray-500 font-mono">
                                    Mapped column: <span className="text-amber-400 font-bold">{results.detected_column}</span> | Threshold: <span className="text-amber-400 font-bold">{results.threshold}%</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={resetChecker}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 border border-white/10 text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Reset / New File</span>
                                </button>

                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-sm font-bold text-black rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,161,22,0.25)] hover:shadow-[0_0_30px_rgba(255,161,22,0.4)] active:scale-95 cursor-pointer"
                                >
                                    <Download className="w-4 h-4 text-black stroke-[2.5]" />
                                    <span>Export Sheet (CSV)</span>
                                </button>
                            </div>
                        </div>

                        {/* Preview Table */}
                        <div className="glass-panel border border-white/5 overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                                    <span>Forensic Preview <span className="text-xs font-normal text-gray-500">(First 100 rows)</span></span>
                                </h3>
                                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                                    Displaying {filteredPreview.length} / {results.preview.length} rows
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left font-sans">
                                    <thead>
                                        <tr className="bg-black/40 border-b border-white/5 text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                                            <th className="py-4 px-6 w-16">Row</th>
                                            <th className="py-4 px-6 min-w-[200px]">Detected User</th>
                                            <th className="py-4 px-6 text-center w-32">AI Score</th>
                                            <th className="py-4 px-6 text-center w-36">AI Score &ge; {results.threshold}</th>
                                            {results.headers.slice(0, 3).map((h, idx) => (
                                                <th key={idx} className="py-4 px-6 text-gray-500 max-w-[150px] truncate">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredPreview.length === 0 ? (
                                            <tr>
                                                <td colSpan={results.headers.length + 4} className="py-12 text-center text-gray-500 font-mono text-sm">
                                                    No matching records found in preview.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPreview.map((row, idx) => (
                                                <tr key={idx} className="bg-transparent hover:bg-white/[0.02] transition-colors group">
                                                    <td className="py-4 px-6 text-gray-500 font-mono text-xs">{row.row_index}</td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-2 font-mono text-sm text-white font-semibold">
                                                            {row.username || <span className="text-gray-600 italic">empty</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-center font-mono text-sm font-bold">
                                                        <span className={clsx(
                                                            row.score !== "N/A" && parseInt(row.score) >= threshold ? "text-red-400" :
                                                            row.score !== "N/A" && parseInt(row.score) >= 40 ? "text-amber-400" : 
                                                            row.score !== "N/A" ? "text-emerald-400" : "text-gray-600"
                                                        )}>
                                                            {row.score}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className={clsx(
                                                            "px-2.5 py-0.5 rounded text-xs font-mono font-bold border inline-flex items-center gap-1",
                                                            row.is_ai === "Yes" 
                                                                ? "bg-red-500/10 border-red-500/20 text-red-400" 
                                                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                        )}>
                                                            {row.is_ai === "Yes" ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                                            {row.is_ai}
                                                        </span>
                                                    </td>
                                                    {results.headers.slice(0, 3).map((h, colIdx) => (
                                                        <td key={colIdx} className="py-4 px-6 text-gray-400 text-xs font-mono max-w-[150px] truncate">
                                                            {row.original_data[h] || "-"}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>
        </div>
    );
}

export default BatchChecker;
