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
            const resp = await axios.get(`http://127.0.0.1:5050/api/results?threshold=${threshold}&contest_slug=${slug}`);
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
        window.location.href = `http://127.0.0.1:5050/api/export?contest_slug=${slug}&threshold=${threshold}`;
    };

    return (
        <div className="min-h-screen bg-transparent relative z-10">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />

            <header className="sticky top-0 z-50 glass-panel border-b-0 border-b-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="bg-sky-500/20 p-2 rounded-xl border border-sky-500/30">
                                <ShieldAlert className="w-6 h-6 text-sky-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight">LeetCode<span className="text-sky-400">Detective</span></h1>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 tracking-wider">MADE BY SANJEEB</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Reference Manager Button */}
                        <button
                            onClick={() => setShowReferenceManager(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all font-medium text-sm"
                        >
                            <Bot className="w-4 h-4" />
                            <span>AI References</span>
                        </button>

                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-xs text-slate-500 font-mono">CONFIDENCE</span>
                            <span className="text-2xl font-bold font-mono text-sky-400">{threshold}%</span>
                        </div>
                        <div className="w-48">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value)}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition-colors"
                            />
                        </div>
                        <button
                            onClick={handleExport}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <div className="flex items-center gap-2 mb-2 text-sky-500 font-medium text-sm">
                        <Cpu className="w-4 h-4" />
                        <span className="tracking-wider uppercase text-xs font-bold">Target Locked</span>
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
                        {slug} <br />
                        <span className="text-slate-500">Security Audit</span>
                    </h2>
                </motion.div>

                <ControlPanel onRefresh={fetchReport} contestSlug={slug} />

                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-4" />
                        <p className="text-slate-400 font-mono animate-pulse">Retrieving intelligence...</p>
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
