import React, { useState } from 'react';
import { parseUnifiedDiff, parseCrewAIOutput, FilePatch } from '../utils/diffParser';

interface CodePatchViewerProps {
    patchText: string;
}

export const CodePatchViewer: React.FC<CodePatchViewerProps> = ({ patchText }) => {
    // Try both parsers
    let files = parseCrewAIOutput(patchText);
    if (files.length === 0) {
        files = parseUnifiedDiff(patchText);
    }

    // If no structured data, show raw patch
    if (files.length === 0) {
        return (
            <div className="bg-[#1a1b1e] border border-gray-800 rounded-lg overflow-hidden mt-3">
                <div className="flex items-center justify-between p-3 bg-black/20 border-b border-gray-800">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Suggested Patch</span>
                    {/* <button
                        onClick={() => navigator.clipboard.writeText(patchText)}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider transition-colors"
                    >
                        COPY
                    </button> */}
                </div>
                <pre className="p-4 text-[12px] font-mono text-gray-300 overflow-x-auto max-h-96">
                    <code>{patchText}</code>
                </pre>
            </div>
        );
    }

    return (
        <div className="mt-3 space-y-3">
            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Code Changes ({files.length} {files.length === 1 ? 'file' : 'files'})
            </div>

            {files.map((file, idx) => (
                <FileChangeCard key={idx} file={file} />
            ))}
        </div>
    );
};

const FileChangeCard: React.FC<{ file: FilePatch }> = ({ file }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const addedLines = file.changes.filter(c => c.type === 'add');
    const removedLines = file.changes.filter(c => c.type === 'remove');

    const fullCode = file.changes.map(c => c.content).join('\n');

    return (
        <div className="bg-[#1a1b1e] border border-gray-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 bg-black/20 border-b border-gray-800 cursor-pointer hover:bg-black/30 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[12px] text-gray-200 font-mono truncate">{file.filePath}</span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    {removedLines.length > 0 && (
                        <span className="text-[10px] text-red-400 font-mono">-{removedLines.length}</span>
                    )}
                    {addedLines.length > 0 && (
                        <span className="text-[10px] text-green-400 font-mono">+{addedLines.length}</span>
                    )}
                    {/* <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(fullCode); }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider transition-colors"
                    >
                        COPY
                    </button> */}
                    <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Code Content */}
            {isExpanded && (
                <div className="p-4 bg-[#0d1117] overflow-x-auto max-h-96">
                    <pre className="text-[12px] font-mono">
                        {file.changes.map((change, idx) => (
                            <div
                                key={idx}
                                className={`${change.type === 'add'
                                    ? 'bg-green-500/10 text-green-300'
                                    : change.type === 'remove'
                                        ? 'bg-red-500/10 text-red-300'
                                        : 'text-gray-400'
                                    }`}
                            >
                                <span className="select-none mr-2 opacity-50">
                                    {change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' '}
                                </span>
                                {change.content}
                            </div>
                        ))}
                    </pre>
                </div>
            )}
        </div>
    );
};
