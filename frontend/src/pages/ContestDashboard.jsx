import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import ControlPanel from '../components/ControlPanel';
import ResultsDashboard from '../components/ResultsDashboard';
import ReferenceManager from '../components/ReferenceManager';
import { ShieldAlert, Activity, Cpu, ArrowLeft, Loader2, Bot, Download } from 'lucide-react';
import { motion } from 'framer-motion';

function ContestDashboard() {
    const { slug } = useParams();
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

    return (
        <div className="min-h-screen bg-transparent relative z-10 overflow-hidden">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-cyan top-[-100px] left-[-100px]" />
            <div className="glow-blue bottom-[-100px] right-[-100px]" />

            <header className="sticky top-0 z-50 glass-panel rounded-none border-t-0 border-x-0 border-b-white/10 shadow-none">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-6 h-6 text-white" />
                            <div>
                                <h1 className="text-lg font-semibold text-white tracking-tight">LeetCode <span className="text-gray-400 font-normal">Detective</span></h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Reference Manager Button */}
                        <button
                            onClick={() => setShowReferenceManager(true)}
                            className="btn-secondary py-1.5"
                        >
                            <Bot className="w-4 h-4" />
                            <span>AI References</span>
                        </button>

                        <Link
                            to={`/contest/${slug}/ai-suspects`}
                            className="btn-secondary py-1.5 !border-amber-500/30 !text-amber-400 hover:!bg-amber-500/10"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            <span>AI Suspects</span>
                        </Link>

                        <div className="hidden md:flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Confidence</span>
                                <span className="text-lg font-bold font-mono text-white">{threshold}%</span>
                            </div>
                            <div className="w-48 flex items-center">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={threshold}
                                    onChange={(e) => setThreshold(e.target.value)}
                                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-gray-200 transition-colors"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleExport}
                            className="btn-primary py-1.5"
                        >
                            <Download className="w-4 h-4 text-black" />
                            Export
                        </button>
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
