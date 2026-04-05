import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Code, User, Trophy, Loader2, AlertCircle, ShieldAlert, Bot } from 'lucide-react';
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
            const resp = await axios.post('http://127.0.0.1:5050/api/submission_code', {
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

    if (!cluster) return null;

    return (
        <div className="min-h-screen bg-transparent relative z-10 p-8">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />

            <Link to={`/contest/${slug}`} className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            >
                {/* AI Warning Banner */}
                {hasAIReference && (
                    <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex items-center justify-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                        <span className="text-red-200 font-bold tracking-wide">CONFIRMED AI PLAGIARISM: Matches Reference Solution</span>
                    </div>
                )}

                <div className="p-8 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-white">Cluster Breakdown</h1>
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-xs font-mono border border-sky-500/30">
                                {questionId}
                            </span>
                        </div>
                        <p className="text-slate-400">Analysis of <span className="text-white font-bold">{cluster.size}</span> connected submissions</p>
                    </div>
                </div>

                <div className="p-8">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                                    <th className="pb-4 pl-4 font-bold">User</th>
                                    <th className="pb-4 font-bold w-32">Rank</th>
                                    <th className="pb-4 font-bold">Code Submission</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {cluster.members.map((member, i) => {
                                    const isRef = member.username.includes('_AI_REFERENCE_');
                                    return (
                                        <tr key={i} className={clsx("transition-colors group", isRef ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-white/5")}>
                                            <td className="p-4 align-top">
                                                {isRef ? (
                                                    <div className="flex items-center gap-2 text-red-400 font-bold">
                                                        <Bot className="w-4 h-4" />
                                                        AI REFERENCE
                                                    </div>
                                                ) : (
                                                    <a
                                                        href={`https://leetcode.com/u/${member.slug || member.username}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-mono text-sky-400 font-medium hover:text-sky-300 hover:underline transition-colors block mb-1"
                                                    >
                                                        {member.username}
                                                    </a>
                                                )}
                                            </td>
                                            <td className="p-4 align-top">
                                                <span className={clsx("font-mono text-sm", isRef ? "text-slate-500 italic" : "text-emerald-400")}>
                                                    {isRef ? "Reference" : `#${member.rank}`}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative">
                                                    {loadingCodes[member.username] ? (
                                                        <div className="flex items-center gap-2 text-slate-500 text-sm h-32">
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Loading code...
                                                        </div>
                                                    ) : codes[member.username] ? (
                                                        <div className="relative group/code">
                                                            {/* AI Badge Overlay */}
                                                            {codes[member.username].analysis && (
                                                                <div className="absolute top-2 right-2 z-10">
                                                                    <div className={clsx(
                                                                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 cursor-help backdrop-blur-md",
                                                                        codes[member.username].analysis.score > 70 ? "bg-red-500/20 text-red-400 border border-red-500/30" :
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
                                                                </div>
                                                            )}

                                                            <pre className="font-mono text-xs bg-slate-950/50 p-4 rounded-lg border border-white/5 overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar text-slate-300">
                                                                <code>{codes[member.username].code}</code>
                                                            </pre>
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-600 text-sm italic py-4">
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
        </div>
    );
}

export default ClusterDetails;
