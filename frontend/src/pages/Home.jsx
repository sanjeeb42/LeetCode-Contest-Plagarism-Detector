import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ShieldCheck, 
    ArrowRight, 
    Terminal, 
    Bot, 
    Fingerprint, 
    Activity, 
    Plus, 
    Trash2,
    Code2,
    Github
} from 'lucide-react';
import clsx from 'clsx';

function Home() {
    const [contests, setContests] = useState([]);
    const [newSlug, setNewSlug] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);

    // Initial load from Backend
    useEffect(() => {
        const fetchContests = async () => {
            try {
                const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/contests`);
                setContests(resp.data);
            } catch (error) {
                console.error("Failed to load contests", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContests();
    }, []);

    // Save changes to backend
    const saveContests = async (updatedContests) => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/contests`, updatedContests);
        } catch (error) {
            console.error("Failed to save contests", error);
        }
    };

    const handleAddContest = (e) => {
        e.preventDefault();
        if (!newSlug.trim()) return;

        const slug = newSlug.trim().toLowerCase().replace(/\s+/g, '-');

        if (contests.find(c => c.slug === slug)) {
            alert('Contest already exists!');
            return;
        }

        const name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const updated = [...contests, { name, slug }];
        setContests(updated);
        saveContests(updated);
        setNewSlug('');
        setIsAdding(false);
    };

    const removeContest = (e, slugToDelete) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`Delete ${slugToDelete}? This only hides it from the list.`)) {
            const updated = contests.filter(c => c.slug !== slugToDelete);
            setContests(updated);
            saveContests(updated);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <div className="min-h-screen bg-[#050403] relative overflow-hidden flex flex-col font-sans">
            {/* Base Atmosphere */}
            <div className="fixed inset-0 fractalNoise pointer-events-none opacity-50 z-0" />
            
            {/* Deep glowing background blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#FFA116]/10 blur-[120px] pointer-events-none z-0" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none z-0" />

            {/* Navigation */}
            <nav className="relative z-50 w-full border-b border-white/[0.08] bg-[#0A0806]/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-[#FFA116]" />
                        <span className="text-white font-semibold tracking-tight text-lg">LeetCode Detective</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://github.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors">
                            <Github className="w-5 h-5" />
                        </a>
                        <Link to="/generate-report" className="text-sm font-medium text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md transition-colors border border-white/10">
                            New Scan
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="flex-1 relative z-10 w-full">
                {/* Hero Section */}
                <section className="max-w-7xl mx-auto px-6 pt-24 pb-32">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <motion.div 
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="max-w-2xl"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFA116]/10 border border-[#FFA116]/20 text-[#FFA116] text-xs font-semibold uppercase tracking-wider mb-8">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFA116] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFA116]"></span>
                                </span>
                                v2.0 Live Analysis Engine
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
                                Unmask Code Plagiarism with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFA116] to-amber-300">Unprecedented</span> Accuracy.
                            </h1>
                            <p className="text-lg text-gray-400 mb-10 leading-relaxed">
                                Go beyond simple text comparison. Our deep-analysis engine uses Abstract Syntax Trees, AI-generation heuristics, and live typing forensics to detect cheating in competitive programming.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <button 
                                    onClick={() => document.getElementById('investigations').scrollIntoView({ behavior: 'smooth' })}
                                    className="btn-primary py-3 px-8 text-sm group"
                                >
                                    View Active Scans
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <Link to="/generate-report" className="btn-secondary py-3 px-8 text-sm">
                                    Start New Scan
                                </Link>
                            </div>
                        </motion.div>

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="relative hidden lg:block"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-[#FFA116]/20 to-transparent blur-3xl -z-10" />
                            <div className="glass-panel p-1 rounded-2xl border border-white/10 bg-[#0A0806]/80 overflow-hidden shadow-2xl">
                                <div className="h-8 border-b border-white/10 flex items-center px-4 gap-2 bg-white/5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                    <div className="mx-auto text-xs text-gray-500 font-mono">analysis_engine.py</div>
                                </div>
                                <div className="p-6 font-mono text-sm text-gray-400 space-y-4">
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">1</span>
                                        <span className="text-emerald-400">import</span> <span className="text-gray-200">ASTComparer</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">2</span>
                                        <span className="text-emerald-400">import</span> <span className="text-gray-200">ReplayForensics</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">3</span>
                                        <span></span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">4</span>
                                        <span><span className="text-blue-400">def</span> <span className="text-yellow-300">analyze_cluster</span>(submissions):</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">5</span>
                                        <span className="pl-4">similarity = ASTComparer.run(submissions)</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">6</span>
                                        <span className="pl-4">ai_risk = <span className="text-amber-400">detect_llm_patterns</span>(submissions)</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="text-gray-600">7</span>
                                        <span className="pl-4">paste_events = ReplayForensics.check_typing()</span>
                                    </div>
                                    <div className="flex gap-4 animate-pulse">
                                        <span className="text-gray-600">8</span>
                                        <span className="pl-4 text-[#FFA116] font-semibold">{'>'} HIGH RISK DETECTED: 94% SIMILARITY</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="border-y border-white/[0.05] bg-white/[0.02] backdrop-blur-sm relative z-20 py-24">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-3xl font-bold text-white mb-4">Enterprise-Grade Detection</h2>
                            <p className="text-gray-400">Three complementary layers of analysis ensure absolute certainty when flagging suspicious submissions.</p>
                        </div>
                        
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true, margin: "-100px" }}
                            className="grid md:grid-cols-3 gap-8"
                        >
                            <motion.div variants={itemVariants} className="glass-card p-8 group hover:border-[#FFA116]/30 transition-colors duration-500">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                    <Fingerprint className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">AST Comparison</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Code is parsed into Abstract Syntax Trees before comparison, meaning cheaters can't hide by renaming variables or changing formatting.
                                </p>
                            </motion.div>

                            <motion.div variants={itemVariants} className="glass-card p-8 group hover:border-[#FFA116]/30 transition-colors duration-500">
                                <div className="w-12 h-12 rounded-xl bg-[#FFA116]/10 border border-[#FFA116]/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                    <Activity className="w-6 h-6 text-[#FFA116]" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">Typing Forensics</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Visual playback of the user's keystrokes. Instantly catch impossible "copy-paste" events where 100+ lines appear in milliseconds.
                                </p>
                            </motion.div>

                            <motion.div variants={itemVariants} className="glass-card p-8 group hover:border-[#FFA116]/30 transition-colors duration-500">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                    <Bot className="w-6 h-6 text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">AI Signature Scan</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Heuristics that identify highly distinct LLM-generated code patterns, excessive comments, and uncharacteristic performance spikes.
                                </p>
                            </motion.div>
                        </motion.div>
                    </div>
                </section>

                {/* Dashboard Section */}
                <section id="investigations" className="py-24 max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Active Investigations</h2>
                            <p className="text-gray-400">Select a contest to view detected plagiarism clusters.</p>
                        </div>
                        
                        <div className="flex gap-3">
                            {isAdding ? (
                                <motion.form 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    onSubmit={handleAddContest} 
                                    className="flex gap-2"
                                >
                                    <input
                                        type="text"
                                        placeholder="e.g., weekly-contest-482"
                                        value={newSlug}
                                        onChange={(e) => setNewSlug(e.target.value)}
                                        className="bg-[#0A0806] border border-white/10 rounded-md px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFA116]/50 w-64"
                                        autoFocus
                                    />
                                    <button type="submit" className="btn-primary px-4 py-2 text-sm">Add</button>
                                    <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                                </motion.form>
                            ) : (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="btn-secondary py-2 px-4 text-sm"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Track New Contest
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-48 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-t-2 border-[#FFA116] animate-spin" />
                        </div>
                    ) : (
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence>
                                {contests.map((contest) => (
                                    <motion.div
                                        key={contest.slug}
                                        layout
                                        variants={itemVariants}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="relative group h-full"
                                    >
                                        <Link to={`/contest/${contest.slug}`} className="block h-full">
                                            <div className="glass-card p-6 h-full flex flex-col justify-between hover:border-white/20 transition-all duration-300">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-[#FFA116]/10 group-hover:border-[#FFA116]/30 transition-all">
                                                        <Code2 className="w-5 h-5" />
                                                    </div>
                                                    <button
                                                        onClick={(e) => removeContest(e, contest.slug)}
                                                        className="text-gray-600 hover:text-red-400 p-2 rounded-md hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Remove contest"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#FFA116] transition-colors">{contest.name}</h3>
                                                    <p className="text-xs text-gray-500 font-mono">{contest.slug}</p>
                                                </div>
                                                
                                                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Scan Ready</span>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            
                            {contests.length === 0 && (
                                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center glass-panel rounded-2xl border border-white/5 border-dashed">
                                    <Terminal className="w-12 h-12 text-gray-600 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">No active investigations</h3>
                                    <p className="text-sm text-gray-500 mb-6">Start by generating a new report or tracking an existing contest.</p>
                                    <Link to="/generate-report" className="btn-primary py-2 px-6 text-sm">Generate Report</Link>
                                </div>
                            )}
                        </motion.div>
                    )}
                </section>
            </main>

            <footer className="border-t border-white/[0.05] bg-[#050403] py-8 relative z-10 mt-12">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-gray-600" />
                        <span>LeetCode Detective &copy; {new Date().getFullYear()}</span>
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white transition-colors">Documentation</a>
                        <a href="https://github.com/sanjeeb42" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Home;
