import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronRight, Hash, Plus, X } from 'lucide-react';
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

        // Prevent duplicates
        if (contests.find(c => c.slug === slug)) {
            alert('Contest already exists!');
            return;
        }

        const name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        // Pick a random color
        const colors = ['sky', 'violet', 'emerald', 'rose', 'amber', 'fuchsia', 'cyan'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const updated = [...contests, { name, slug, color }];
        setContests(updated);
        saveContests(updated); // Persist
        setNewSlug('');
        setIsAdding(false);
    };

    const removeContest = (e, slugToDelete) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`Delete ${slugToDelete}? This only hides it from the list.`)) {
            const updated = contests.filter(c => c.slug !== slugToDelete);
            setContests(updated);
            saveContests(updated); // Persist
        }
    };

    return (
        <div className="min-h-screen bg-transparent relative z-10 flex flex-col items-center justify-center p-6">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />

            <div className="text-center mb-16 space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-800/50 backdrop-blur-xl border border-white/10 mb-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-transparent opacity-50" />
                    <Shield className="w-10 h-10 text-sky-400 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white">
                    LeetCode<span className="text-sky-500">Detective</span>
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Select a contest sector to initialize plagiarism detection protocols.
                </p>
                <p className="text-xs text-slate-600 font-mono pt-4">
                    MADE BY <span className="text-sky-500 font-bold">SANJEEB</span>
                </p>
            </div>

            <div className="w-full max-w-4xl mb-6 flex justify-end gap-4">
                {loading && <span className="text-slate-500 text-sm animate-pulse my-auto">Syncing...</span>}
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all font-medium text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Contest
                </button>
                <Link
                    to="/generate-report"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-medium text-sm"
                >
                    Generate Report
                </Link>
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="w-full max-w-4xl mb-6 overflow-hidden"
                    >
                        <form onSubmit={handleAddContest} className="glass-card p-4 rounded-xl flex gap-4 items-center">
                            <input
                                type="text"
                                placeholder="Enter contest slug (e.g., weekly-contest-482)"
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value)}
                                className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-lg transition-colors"
                            >
                                Add
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                <AnimatePresence>
                    {contests.map((contest) => (
                        <Link to={`/contest/${contest.slug}`} key={contest.slug}>
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{ y: -5, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="glass-card p-6 rounded-2xl flex items-center justify-between group cursor-pointer border border-white/5 hover:border-white/20 relative"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "w-12 h-12 rounded-xl flex items-center justify-center",
                                        `bg-${contest.color}-500/10 text-${contest.color}-400`
                                    )}>
                                        <Hash className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white group-hover:text-sky-400 transition-colors">
                                            {contest.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 font-mono tracking-wider">
                                            {contest.slug}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => removeContest(e, contest.slug)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors z-20"
                                        title="Remove from list"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default Home;
