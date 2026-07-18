const fs = require('fs');
const path = require('path');

const dir = 'src';

const mappings = [
    // Backgrounds
    { rx: /bg-\[#[0-9a-fA-F]{3,6}\]/g, replace: 'bg-background' },
    { rx: /bg-slate-50\b/g, replace: 'bg-background' },
    { rx: /bg-[#0a0a0a]\b/g, replace: 'bg-background' },
    { rx: /bg-slate-900\b/g, replace: 'bg-surface' },
    { rx: /bg-slate-950\b/g, replace: 'bg-surface' },
    { rx: /bg-slate-800\b/g, replace: 'bg-surface-muted' },
    { rx: /bg-slate-800\/50\b/g, replace: 'bg-surface-muted' },
    { rx: /bg-slate-700\b/g, replace: 'bg-surface-muted' },
    { rx: /bg-slate-100\b/g, replace: 'bg-surface-muted' },
    
    // Text
    { rx: /text-slate-500\b/g, replace: 'text-muted-foreground' },
    { rx: /text-slate-400\b/g, replace: 'text-muted-foreground' },
    { rx: /text-slate-300\b/g, replace: 'text-muted-foreground' },
    { rx: /text-slate-900\b/g, replace: 'text-foreground' },
    { rx: /text-white\b/g, replace: 'text-foreground' },
    { rx: /text-slate-50\b/g, replace: 'text-foreground' },
    { rx: /text-gray-500\b/g, replace: 'text-muted-foreground' },
    { rx: /text-gray-400\b/g, replace: 'text-muted-foreground' },
    
    // Borders
    { rx: /border-slate-800\b/g, replace: 'border-border' },
    { rx: /border-slate-700\b/g, replace: 'border-border' },
    { rx: /border-slate-200\b/g, replace: 'border-border' },
    { rx: /border-slate-300\b/g, replace: 'border-border' },
    { rx: /border-white\/10\b/g, replace: 'border-border' },
    { rx: /border-white\/20\b/g, replace: 'border-border' },
    { rx: /border-black\/10\b/g, replace: 'border-border' },

    // Primary
    { rx: /bg-blue-600\b/g, replace: 'bg-primary' },
    { rx: /bg-blue-500\b/g, replace: 'bg-primary' },
    { rx: /hover:bg-blue-700\b/g, replace: 'hover:bg-primary-hover' },
    { rx: /hover:bg-blue-600\b/g, replace: 'hover:bg-primary-hover' },
    { rx: /text-blue-500\b/g, replace: 'text-primary' },
    { rx: /text-blue-400\b/g, replace: 'text-primary' },
    { rx: /text-blue-600\b/g, replace: 'text-primary' },
    { rx: /bg-blue-500\/10\b/g, replace: 'bg-primary-soft' },
    { rx: /bg-blue-500\/20\b/g, replace: 'bg-primary-soft' },
    { rx: /border-blue-500\b/g, replace: 'border-primary' },
    { rx: /border-blue-400\b/g, replace: 'border-primary' },
    { rx: /ring-blue-500\b/g, replace: 'ring-primary' },
    { rx: /focus:border-blue-500\b/g, replace: 'focus:border-primary' },

    // Success (Emerald)
    { rx: /text-emerald-500\b/g, replace: 'text-success' },
    { rx: /text-emerald-400\b/g, replace: 'text-success' },
    { rx: /bg-emerald-500\b/g, replace: 'bg-success' },
    { rx: /bg-emerald-500\/10\b/g, replace: 'bg-success-soft' },
    { rx: /bg-emerald-500\/20\b/g, replace: 'bg-success-soft' },
    { rx: /border-emerald-500\/20\b/g, replace: 'border-success' },
    
    // Danger (Red)
    { rx: /text-red-500\b/g, replace: 'text-danger' },
    { rx: /text-red-400\b/g, replace: 'text-danger' },
    { rx: /bg-red-500\b/g, replace: 'bg-danger' },
    { rx: /bg-red-500\/10\b/g, replace: 'bg-danger-soft' },
    { rx: /bg-red-500\/20\b/g, replace: 'bg-danger-soft' },
    { rx: /border-red-500\/20\b/g, replace: 'border-danger' },

    // Purple / Indigo / Cyan (misc brand/accent)
    { rx: /bg-purple-500\b/g, replace: 'bg-primary' },
    { rx: /bg-purple-600\b/g, replace: 'bg-primary' },
    { rx: /text-purple-400\b/g, replace: 'text-primary' },
    { rx: /bg-indigo-500\b/g, replace: 'bg-primary' },
    { rx: /bg-cyan-500\b/g, replace: 'bg-primary' },

    // Gradients
    { rx: /bg-gradient-to-[a-z]+\b/g, replace: '' },
    { rx: /from-blue-600\b/g, replace: '' },
    { rx: /to-indigo-600\b/g, replace: '' },
    { rx: /from-blue-500\b/g, replace: '' },
    { rx: /to-purple-500\b/g, replace: '' },
    { rx: /via-[a-z]+-[0-9]+\b/g, replace: '' },

    // Specific legacy styles to clean up that conflict
    { rx: /dark:bg-slate-900\b/g, replace: '' },
    { rx: /dark:text-slate-200\b/g, replace: '' },
    { rx: /dark:border-slate-800\b/g, replace: '' },
];

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            for (const { rx, replace } of mappings) {
                if (rx.test(content)) {
                    content = content.replace(rx, replace);
                    modified = true;
                }
            }
            // Clean up multiple spaces left by replacing to empty string
            if (modified) {
                content = content.replace(/className="([^"]*)"/g, (match, p1) => {
                    const cleaned = p1.replace(/\s+/g, ' ').trim();
                    return `className="${cleaned}"`;
                });
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDirectory(dir);
