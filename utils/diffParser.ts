// Parse unified diff format into structured file changes
export interface FilePatch {
    filePath: string;
    oldPath?: string;
    newPath?: string;
    changes: CodeChange[];
}

export interface CodeChange {
    type: 'add' | 'remove' | 'context';
    lineNumber?: number;
    content: string;
}

export function parseUnifiedDiff(diffText: string): FilePatch[] {
    const files: FilePatch[] = [];
    const lines = diffText.split('\n');

    let currentFile: FilePatch | null = null;
    let currentChanges: CodeChange[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect file header (--- a/path or +++ b/path)
        if (line.startsWith('--- ')) {
            if (currentFile) {
                currentFile.changes = currentChanges;
                files.push(currentFile);
            }
            const oldPath = line.replace('--- a/', '').replace('--- ', '');
            currentFile = { filePath: oldPath, oldPath, changes: [] };
            currentChanges = [];
        } else if (line.startsWith('+++ ') && currentFile) {
            const newPath = line.replace('+++ b/', '').replace('+++ ', '');
            currentFile.newPath = newPath;
            currentFile.filePath = newPath;
        } else if (line.startsWith('@@')) {
            // Chunk header - skip for now
            continue;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            currentChanges.push({ type: 'add', content: line.substring(1) });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            currentChanges.push({ type: 'remove', content: line.substring(1) });
        } else if (line.startsWith(' ')) {
            currentChanges.push({ type: 'context', content: line.substring(1) });
        }
    }

    // Push last file
    if (currentFile) {
        currentFile.changes = currentChanges;
        files.push(currentFile);
    }

    return files;
}

// Extract file-specific sections from Developer's output
export function parseCrewAIOutput(output: string): FilePatch[] {
    const files: FilePatch[] = [];

    // Match pattern: 📁 **File:** path
    const fileRegex = /📁\s*\*\*File:\*\*\s*(.+?)(?:\n|$)/g;
    const sections = output.split(/📁\s*\*\*File:\*\*/);

    sections.forEach((section, idx) => {
        if (idx === 0) return; // Skip intro text

        const lines = section.split('\n');
        const filePath = lines[0].trim();

        // Extract Current Code block
        const currentMatch = section.match(/❌\s*\*\*Current Code:\*\*\s*```[\w]*\n([\s\S]*?)```/);
        const replaceMatch = section.match(/✅\s*\*\*Replace With:\*\*\s*```[\w]*\n([\s\S]*?)```/);

        if (currentMatch && replaceMatch) {
            const currentCode = currentMatch[1].trim();
            const newCode = replaceMatch[1].trim();

            const changes: CodeChange[] = [
                ...currentCode.split('\n').map(line => ({ type: 'remove' as const, content: line })),
                ...newCode.split('\n').map(line => ({ type: 'add' as const, content: line }))
            ];

            files.push({ filePath, changes });
        }
    });

    return files;
}
