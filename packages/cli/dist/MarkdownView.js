import React from 'react';
import { Box, Text } from 'ink';
export const MarkdownView = ({ text }) => {
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBuffer = [];
    lines.forEach((line, i) => {
        // Code Block Check
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                elements.push(React.createElement(Box, { key: `code-${i}`, borderStyle: "round", borderColor: "gray", paddingX: 1, marginY: 1 },
                    React.createElement(Text, { color: "white" }, codeBuffer.join('\n'))));
                codeBuffer = [];
                inCodeBlock = false;
            }
            else {
                // Start of code block
                inCodeBlock = true;
            }
            return;
        }
        if (inCodeBlock) {
            codeBuffer.push(line);
            return;
        }
        // List Check
        const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
        if (listMatch) {
            elements.push(React.createElement(Box, { key: i, paddingLeft: 2 },
                React.createElement(Text, { color: "cyan" },
                    listMatch[2],
                    " "),
                React.createElement(Text, null, renderBold(listMatch[3]))));
            return;
        }
        // Header Check
        const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
            elements.push(React.createElement(Box, { key: i, marginTop: 1 },
                React.createElement(Text, { bold: true, color: "blue", underline: true }, headerMatch[2])));
            return;
        }
        // Normal Text
        if (line.trim()) {
            elements.push(React.createElement(Box, { key: i },
                React.createElement(Text, null, renderBold(line))));
        }
        else {
            elements.push(React.createElement(Box, { key: i, height: 1 }));
        }
    });
    return React.createElement(Box, { flexDirection: "column" }, elements);
};
// Helper for bold text: **text** -> Bold
function renderBold(text) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return React.createElement(Text, { key: i, bold: true, color: "yellow" }, part.slice(2, -2));
        }
        return React.createElement(Text, { key: i }, part);
    });
}
