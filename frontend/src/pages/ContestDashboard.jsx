import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ControlPanel from '../components/ControlPanel';
import ResultsDashboard from '../components/ResultsDashboard';
import ReferenceManager from '../components/ReferenceManager';
import { ShieldAlert, Activity, Cpu, ArrowLeft, Loader2, Bot, Download, Trash2, Key } from 'lucide-react';
import { motion } from 'framer-motion';

function ContestDashboard() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [threshold, setThreshold] = useState(50);
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(false);

    // UI State
    const [showReferenceManager, setShowReferenceManager] = useState(false);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/results?threshold=${threshold}&contest_slug=${slug}`);
            setClusters(resp.data);
        } catch (error) {
            console.error("Failed to fetch results:", error);
            setClusters([]);
        } finally {
            setLoading(false);
        }
    }, [threshold, slug]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleExport = () => {
        window.location.href = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/export?contest_slug=${slug}&threshold=${threshold}`;
    };

    const handleDelete = async () => {
        const confirmed = window.confirm(`Are you sure you want to completely delete the dashboard for ${slug}? All fetched submissions, scan data, and AI analysis for this contest will be permanently erased from the server. You can re-fetch everything later if needed.`);
        if (!confirmed) return;

        setLoading(true);
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/contest?contest_slug=${slug}`);
            localStorage.removeItem(`top500_${slug}`);
            navigate('/');
        } catch (error) {
            console.error("Failed to delete dashboard:", error);
            alert("Failed to delete dashboard. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent relative z-10 overflow-hidden">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-cyan top-[-100px] left-[-100px]" />
            <div className="glow-blue bottom-[-100px] right-[-100px]" />

            <header className="sticky top-0 z-50 bg-[#0f0e0d]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl select-none">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
                    {/* Brand & Back Button */}
                    <div className="flex items-center gap-4 shrink-0">
                        <Link 
                            to="/" 
                            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white active:scale-95"
                            title="Back to Home"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <ShieldAlert className="w-7 h-7 text-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-white tracking-tight leading-none">
                                    LeetCode <span className="text-amber-500 font-normal">Detective</span>
                                </h1>
                                <span className="text-[10px] text-gray-500 font-mono mt-1 block">Contest: {slug}</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Pills & Controls */}
                    <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar py-1">
                        {/* Segmented Feature Nav Group */}
                        <div className="flex items-center gap-1.5 p-1 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md shrink-0">
                            <button
                                onClick={() => setShowReferenceManager(true)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-white hover:bg-white/10 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                            >
                                <Bot className="w-3.5 h-3.5 text-amber-400" />
                                <span>AI References</span>
                            </button>

                            <Link
                                to={`/contest/${slug}/ai-suspects`}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                            >
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                <span>AI Suspects</span>
                            </Link>

                            <Link
                                to={`/contest/${slug}/keyword-suspects`}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                            >
                                <Key className="w-3.5 h-3.5 text-red-400" />
                                <span>Keyword Cheaters</span>
                            </Link>
                        </div>

                        {/* Confidence Slider Control */}
                        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-bold">Confidence</span>
                                <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold rounded">
                                    {threshold}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value)}
                                className="w-28 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-colors"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleExport}
                                className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(255,161,22,0.3)] inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all duration-200"
                            >
                                <Download className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                <span>Export</span>
                            </button>

                            <button
                                onClick={handleDelete}
                                className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all duration-200"
                                title="Delete Contest Data"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-10"
                >
                    <div className="flex items-center gap-2 mb-3 text-cyan-400 font-medium text-xs tracking-widest uppercase">
                        <Cpu className="w-4 h-4" />
                        <span>Target Locked</span>
                    </div>
                    <h2 className="text-4xl font-semibold text-white mb-2 tracking-tight">
                        {slug}
                    </h2>
                    <p className="text-gray-400 text-lg">Security Audit & Cluster Analysis</p>
                </motion.div>

                <div className="mb-8">
                    <ControlPanel onRefresh={fetchReport} contestSlug={slug} />
                </div>

                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
                        <p className="text-gray-400 font-mono text-sm tracking-wide">Retrieving intelligence...</p>
                    </div>
                ) : (
                    <ResultsDashboard clusters={clusters} />
                )}
            </main>

            {/* Reference Manager Modal */}
            {showReferenceManager && (
                <ReferenceManager
                    contestSlug={slug}
                    onClose={() => setShowReferenceManager(false)}
                />
            )}
        </div>
    );
}

export default ContestDashboard;
