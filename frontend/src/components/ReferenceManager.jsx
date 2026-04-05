import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Code2 } from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';

const LANGUAGES = [
    { id: 'cpp', name: 'C++' },
    { id: 'java', name: 'Java' },
    { id: 'python3', name: 'Python 3' },
];

const QUESTIONS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function ReferenceManager({ contestSlug, onClose }) {
    const [references, setReferences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'add'
    const [selectedQ, setSelectedQ] = useState('Q1');
    const [selectedLang, setSelectedLang] = useState('cpp');
    const [code, setCode] = useState('');

    useEffect(() => {
        fetchReferences();
    }, [contestSlug]);

    const fetchReferences = async () => {
        try {
            setLoading(true);
            const resp = await axios.get(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/reference?contest_slug=${contestSlug}`);
            setReferences(resp.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!code.trim()) return;
        setSubmitting(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/reference`, {
                contest_slug: contestSlug,
                question_id: selectedQ,
                language: selectedLang,
                code: code
            });
            await fetchReferences();
            setActiveTab('list');
            setCode('');
        } catch (err) {
            console.error(err);
            alert("Failed to save reference");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-bold text-lg text-white">Manage AI References</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={clsx("flex-1 py-3 text-sm font-medium transition-colors border-b-2", activeTab === 'list' ? "border-indigo-500 text-indigo-400 bg-white/5" : "border-transparent text-slate-400 hover:text-slate-200")}
                    >
                        Existing References
                    </button>
                    <button
                        onClick={() => setActiveTab('add')}
                        className={clsx("flex-1 py-3 text-sm font-medium transition-colors border-b-2", activeTab === 'add' ? "border-indigo-500 text-indigo-400 bg-white/5" : "border-transparent text-slate-400 hover:text-slate-200")}
                    >
                        Add New Reference
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
                    {activeTab === 'list' && (
                        <div className="space-y-4">
                            {loading ? (
                                <div className="text-center text-slate-500 py-8">Loading...</div>
                            ) : references.length === 0 ? (
                                <div className="text-center text-slate-500 py-8 italic">No references added yet.</div>
                            ) : (
                                references.map((ref, idx) => (
                                    <div key={idx} className="bg-slate-800 border border-white/5 rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2">
                                                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded border border-indigo-500/30 font-mono">{ref.question_id}</span>
                                                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded font-mono">{ref.language}</span>
                                            </div>
                                        </div>
                                        <pre className="mt-2 text-xs font-mono bg-black/30 p-3 rounded border border-white/5 text-slate-400 overflow-x-auto max-h-32">
                                            {ref.code}
                                        </pre>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'add' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">Question</label>
                                    <div className="flex gap-2">
                                        {QUESTIONS.map(q => (
                                            <button
                                                key={q}
                                                onClick={() => setSelectedQ(q)}
                                                className={clsx("flex-1 py-2 text-sm rounded border transition-colors", selectedQ === q ? "bg-indigo-500 text-white border-indigo-500" : "bg-slate-800 text-slate-400 border-white/10 hover:border-white/20")}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">Language</label>
                                    <select
                                        value={selectedLang}
                                        onChange={(e) => setSelectedLang(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded p-2 text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        {LANGUAGES.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">AI Generated Code</label>
                                <textarea
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="Paste the ChatGPT/Claude solution here..."
                                    className="w-full h-64 bg-slate-950 border border-white/10 rounded-lg p-4 font-mono text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {activeTab === 'add' && (
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !code.trim()}
                            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            {submitting ? <span className="animate-spin text-lg">⟳</span> : <Save className="w-4 h-4" />}
                            Save Reference
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
