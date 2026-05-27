import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Code, User, Trophy, Loader2, AlertCircle, ShieldAlert, Bot, Play } from 'lucide-react';
import ReplayViewer from '../components/ReplayViewer';
import { motion } from 'framer-motion';
import clsx from 'clsx';

function ClusterDetails() {
    const { slug, questionId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // Expect cluster data to be passed in state
    const { cluster, clusterIndex } = location.state || {};

    const [codes, setCodes] = useState({});
    const [loadingCodes, setLoadingCodes] = useState({});

    // Check for AI Reference Match
    const hasAIReference = cluster?.members?.some(m => m.username.includes('_AI_REFERENCE_')) || false;

    useEffect(() => {
        if (!cluster) {
            navigate(`/contest/${slug}`);
        }
    }, [cluster, navigate, slug]);

    // Fetch code for a user
    const fetchCode = async (username) => {
        if (codes[username] || loadingCodes[username]) return;

        setLoadingCodes(prev => ({ ...prev, [username]: true }));
        try {
            const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/submission_code`, {
                contest_slug: slug,
                question_id: questionId,
                username: username
            });
            setCodes(prev => ({
                ...prev,
                [username]: {
                    code: resp.data.code,
                    analysis: resp.data.ai_analysis
                }
            }));
        } catch (error) {
            console.error("Failed to fetch code:", error);
            setCodes(prev => ({
                ...prev,
                [username]: { code: "Error generating preview or code not found." }
            }));
        } finally {
            setLoadingCodes(prev => ({ ...prev, [username]: false }));
        }
    };

    // Auto-fetch code for all members
    useEffect(() => {
        if (cluster?.members) {
            cluster.members.forEach(member => {
                fetchCode(member.username);
            });
        }
    }, [cluster]);

    const [overriding, setOverriding] = useState({});
    const [viewingReplayFor, setViewingReplayFor] = useState(null);

    const handleOverride = async (username, isAI) => {
        setOverriding(prev => ({ ...prev, [username]: true }));
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/override_ai`, {
                contest_slug: slug,
                username: username,
                is_ai: isAI
            });
            // Update local state to reflect override without needing a full reload
            setCodes(prev => ({
                ...prev,
                [username]: {
                    ...prev[username],
                    analysis: {
                        score: isAI ? 100 : 0,
                        reasons: [`Manual override: ${isAI ? 'Flagged as AI' : 'Verified Human'}`]
                    }
                }
            }));
        } catch (error) {
            console.error("Failed to override:", error);
            alert("Failed to override AI status.");
        } finally {
            setOverriding(prev => ({ ...prev, [username]: false }));
        }
    };

    if (!cluster) return null;

    return (
        <div className="min-h-screen bg-transparent relative z-10 p-8 overflow-hidden">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-blue top-[-200px] right-[-200px]" />

            <Link to={`/contest/${slug}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel overflow-hidden"
            >
                {/* AI Warning Banner */}
                {hasAIReference && (
                    <div className="bg-[#ff4500]/10 border-b border-[#ff4500]/20 p-4 flex items-center justify-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-[#ff4500] animate-pulse" />
                        <span className="text-[#ff4500] font-medium tracking-wide text-sm">CONFIRMED AI PLAGIARISM: Matches Reference Solution</span>
                    </div>
                )}

                <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-semibold text-white">Cluster Breakdown</h1>
                            <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 text-xs font-mono border border-white/10">
                                {questionId}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm">Analysis of <span className="text-white font-medium">{cluster.size}</span> connected submissions</p>
                    </div>
                </div>

                <div className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500 bg-white/[0.02]">
                                    <th className="py-4 pl-8 font-medium">User</th>
                                    <th className="py-4 font-medium w-32">Rank</th>
                                    <th className="py-4 font-medium">Code Submission</th>
                                </tr>
                            </thead>
                            <div className="h-4" />
                            <tbody className="divide-y divide-white/5">
                                {cluster.members.map((member, i) => {
                                    const isRef = member.username.includes('_AI_REFERENCE_');
                                    return (
                                        <tr key={i} className={clsx("transition-colors group", isRef ? "bg-[#ff4500]/5 hover:bg-[#ff4500]/10" : "hover:bg-white/[0.02]")}>
                                            <td className="p-6 pl-8 align-top">
                                                {isRef ? (
                                                    <div className="flex items-center gap-2 text-[#ff4500] font-semibold text-sm">
                                                        <Bot className="w-4 h-4" />
                                                        AI REFERENCE
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <a
                                                            href={`https://leetcode.com/u/${member.slug || member.username}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-white hover:text-gray-300 transition-colors block mb-2 text-sm"
                                                        >
                                                            {member.username}
                                                        </a>
                                                        <div className="flex flex-col gap-2 mt-3">
                                                            <button 
                                                                disabled={overriding[member.username]}
                                                                onClick={() => handleOverride(member.username, true)}
                                                                className="text-[10px] w-full text-left px-2 py-1.5 rounded bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-all font-medium"
                                                            >
                                                                {overriding[member.username] ? '...' : '⚠ Mark AI'}
                                                            </button>
                                                            <button 
                                                                disabled={overriding[member.username]}
                                                                onClick={() => handleOverride(member.username, false)}
                                                                className="text-[10px] w-full text-left px-2 py-1.5 rounded bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-all font-medium"
                                                            >
                                                                {overriding[member.username] ? '...' : '✓ Mark Human'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-6 align-top">
                                                <span className={clsx("font-mono text-sm", isRef ? "text-gray-500 italic" : "text-gray-400")}>
                                                    {isRef ? "Reference" : `#${member.rank}`}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="relative">
                                                    {loadingCodes[member.username] ? (
                                                        <div className="flex items-center gap-2 text-gray-500 text-sm h-32">
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Loading code...
                                                        </div>
                                                    ) : codes[member.username] ? (
                                                        <div className="relative group/code">
                                                            {/* Action Bar: AI Badge & Replay */}
                                                            <div className="flex justify-end items-center gap-3 mb-3 relative z-20">
                                                                {codes[member.username].analysis && (
                                                                    <div className={clsx(
                                                                        "px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 cursor-help backdrop-blur-md",
                                                                        codes[member.username].analysis.score > 70 ? "bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30" :
                                                                            codes[member.username].analysis.score > 30 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                                                                "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                                    )} title={codes[member.username].analysis.reasons.join(", ")}>
                                                                        <span>
                                                                            {codes[member.username].analysis.score > 70 ? "Likely AI" :
                                                                                codes[member.username].analysis.score > 30 ? "Suspicious" : "Clean"}
                                                                        </span>
                                                                        <span className="opacity-70">
                                                                            {codes[member.username].analysis.score}%
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                
                                                                <button 
                                                                    onClick={() => setViewingReplayFor(member.username)}
                                                                    className="btn-secondary py-1 text-[11px]"
                                                                >
                                                                    <Play className="w-3 h-3" />
                                                                    Watch Replay
                                                                </button>
                                                            </div>

                                                            <pre className="font-mono text-[13px] leading-relaxed bg-[#050505] p-5 rounded-xl border border-white/5 overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar text-gray-300">
                                                                <code>{codes[member.username].code}</code>
                                                            </pre>
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-600 text-sm italic py-4">
                                                            Code execution not available or failed to load.
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>

            {viewingReplayFor && (
                <ReplayViewer 
                    contestSlug={slug}
                    questionId={questionId}
                    username={viewingReplayFor}
                    userSlug={cluster?.members?.find(m => m.username === viewingReplayFor)?.slug || viewingReplayFor}
                    onClose={() => setViewingReplayFor(null)}
                />
            )}
        </div>
    );
}

export default ClusterDetails;
