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
        <div className="min-h-screen bg-transparent relative z-10 flex flex-col items-center justify-center p-6 overflow-hidden">
            <div className="fixed inset-0 bg-grid z-[-1] pointer-events-none" />
            <div className="glow-blue top-[-200px] right-[-200px]" />

            <div className="flex w-full max-w-2xl mb-8 relative z-10">
                <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" /> Back to Dashboard
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl glass-panel relative z-10"
            >
                <div className="p-8 border-b border-white/10 flex flex-col items-center text-center bg-white/[0.01]">
                    <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mb-6">
                        <FileSpreadsheet className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight">Generate Report</h1>
                    <p className="text-gray-400 max-w-md text-sm leading-relaxed">
                        Upload your LeetCode sheet. The backend will process ratings entirely in-memory—nothing is saved.
                    </p>
                </div>

                <div className="p-8 space-y-8">
                    {!downloadUrl ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className={clsx(
                                    "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                                    selectedFile ? "border-white/30 bg-white/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]",
                                    error ? "border-[#ff4500]/50 bg-[#ff4500]/5" : ""
                                )}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {selectedFile ? (
                                            <FileSpreadsheet className="w-10 h-10 text-white mb-4" />
                                        ) : (
                                            <Upload className="w-10 h-10 text-gray-500 mb-4" />
                                        )}
                                        <p className="mb-2 text-sm text-gray-400">
                                            {selectedFile ? (
                                                <span className="font-semibold text-white">{selectedFile.name}</span>
                                            ) : (
                                                <><span className="font-semibold text-white">Upload Excel/CSV sheet</span> or drag here</>
                                            )}
                                        </p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".csv,.txt,.xlsx,.xls" />
                                </label>
                            </div>

                            {error && <p className="text-[#ff4500] text-sm text-center">{error}</p>}

                            <button
                                onClick={handleGenerate}
                                disabled={!selectedFile || isProcessing}
                                className="w-full btn-primary py-4 justify-center text-base"
                            >
                                {isProcessing ? (
                                    <><Loader2 className="w-5 h-5 animate-spin text-black" /> Processing Sheet...</>
                                ) : (
                                    <>Generate Output Sheet</>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            <div className="w-20 h-20 bg-white/[0.05] border border-white/20 rounded-full flex justify-center items-center mb-2 animate-in zoom-in duration-300">
                                <CheckCircle className="w-10 h-10 text-white" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-semibold text-white mb-2">Processing Complete</h3>
                                <p className="text-gray-400">Your output sheet is ready to download.</p>
                            </div>
                            
                            <a
                                href={downloadUrl}
                                download={downloadFileName}
                                className="btn-primary w-full py-4 justify-center text-base"
                            >
                                <Download className="w-5 h-5 text-black" /> Download Result
                            </a>
                            
                            <button
                                onClick={() => {
                                    setDownloadUrl('');
                                    setSelectedFile(null);
                                }}
                                className="text-gray-500 hover:text-white transition-colors pt-4 text-sm font-medium"
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
