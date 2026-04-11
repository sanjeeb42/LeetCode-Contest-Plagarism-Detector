import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, FileSpreadsheet, Download, Loader2, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';

function GenerateReport() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [downloadUrl, setDownloadUrl] = useState('');
    const [downloadFileName, setDownloadFileName] = useState('');

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setError('');
            setDownloadUrl('');
        }
    };

    const handleGenerate = async () => {
        if (!selectedFile) {
            setError("Please upload an Excel/CSV sheet first.");
            return;
        }

        setIsProcessing(true);
        setError('');
        setDownloadUrl('');

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5050'}/api/generate_report`, formData, {
                responseType: 'blob', // Important for file download
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // The file was processed completely in-memory, now create a URL for it
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            setDownloadUrl(url);
            
            // Set the expected name
            const orig = selectedFile.name;
            const basename = orig.includes('.') ? orig.substring(0, orig.lastIndexOf('.')) : orig;
            const ext = orig.includes('.') ? orig.substring(orig.lastIndexOf('.')) : '.csv';
            
            setDownloadFileName(`${basename}_output${ext}`);

        } catch (err) {
            console.error("Processing error:", err);
            setError("Failed to generate report. Make sure the sheet format is valid.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent relative z-10 flex flex-col items-center justify-center p-6">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />

            <div className="flex w-full max-w-2xl mb-8">
                <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" /> Back to Dashboard
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            >
                <div className="p-8 border-b border-white/10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
                        <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Generate Report</h1>
                    <p className="text-slate-400 max-w-md">
                        Upload your LeetCode sheet. The backend will process ratings entirely in-memory—nothing is saved.
                    </p>
                </div>

                <div className="p-8 space-y-8">
                    {!downloadUrl ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className={clsx(
                                    "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors glass-card",
                                    selectedFile ? "border-sky-500/50 bg-sky-500/5" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50",
                                    error ? "border-red-500/50 bg-red-500/5" : ""
                                )}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {selectedFile ? (
                                            <FileSpreadsheet className="w-12 h-12 text-sky-400 mb-4" />
                                        ) : (
                                            <Upload className="w-10 h-10 text-slate-400 mb-4" />
                                        )}
                                        <p className="mb-2 text-sm text-slate-300">
                                            {selectedFile ? (
                                                <span className="font-semibold text-sky-400">{selectedFile.name}</span>
                                            ) : (
                                                <><span className="font-semibold">Upload Excel/CSV sheet</span> or drag here</>
                                            )}
                                        </p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".csv,.txt,.xlsx,.xls" />
                                </label>
                            </div>

                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                            <button
                                onClick={handleGenerate}
                                disabled={!selectedFile || isProcessing}
                                className="w-full py-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:hover:bg-sky-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/20 flex justify-center items-center gap-2"
                            >
                                {isProcessing ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing Sheet...</>
                                ) : (
                                    <>Generate Output Sheet</>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex justify-center items-center mb-2 animate-in zoom-in duration-300">
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-white mb-2">Processing Complete</h3>
                                <p className="text-slate-400">Your output sheet is ready to download.</p>
                            </div>
                            
                            <a
                                href={downloadUrl}
                                download={downloadFileName}
                                className="px-8 py-4 bg-emerald-500 flex items-center justify-center gap-3 w-full hover:bg-emerald-400 text-slate-900 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <Download className="w-5 h-5" /> Download Result
                            </a>
                            
                            <button
                                onClick={() => {
                                    setDownloadUrl('');
                                    setSelectedFile(null);
                                }}
                                className="text-slate-400 hover:text-white transition-colors underline pt-4"
                            >
                                Process another sheet
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

export default GenerateReport;
