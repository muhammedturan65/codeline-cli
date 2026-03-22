import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownViewProps {
  text: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, i) => {
    // Code Block Check
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <Box key={`code-${i}`} borderStyle="round" borderColor="gray" paddingX={1} marginY={1}>
            <Text color="white">{codeBuffer.join('\n')}</Text>
          </Box>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
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
      elements.push(
        <Box key={i} paddingLeft={2}>
          <Text color="cyan">{listMatch[2]} </Text>
          <Text>{renderBold(listMatch[3])}</Text>
        </Box>
      );
      return;
    }

    // Header Check
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      elements.push(
        <Box key={i} marginTop={1}>
          <Text bold color="blue" underline>{headerMatch[2]}</Text>
        </Box>
      );
      return;
    }

    // Normal Text
    if (line.trim()) {
      elements.push(
        <Box key={i}>
          <Text>{renderBold(line)}</Text>
        </Box>
      );
    } else {
      elements.push(<Box key={i} height={1} />);
    }
  });

  return <Box flexDirection="column">{elements}</Box>;
};

// Helper for bold text: **text** -> Bold
function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} bold color="yellow">{part.slice(2, -2)}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}
