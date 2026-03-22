import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { OpenRouterClient, ToolRegistry, AgentScheduler, readFileTool, writeFileTool, replaceTool, askUserTool, askUserBus, AskUserRequest, runShellTool, confirmationBus, ConfirmationRequest, listDirectoryTool, grepSearchTool, SYSTEM_PROMPT, activateSkillTool, skillRegistry, delegateTaskTool, connectMcpTool, readManyFilesTool, debugServer } from '@ai-agent/core';
import { MarkdownView } from './MarkdownView.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start Debug Server
debugServer.start();

interface Message {
  role: 'user' | 'assistant' | 'system' | 'thinking' | 'tool' | 'confirmation';
  content: string;
}

// Ensure environment variables are loaded from the project root if they're missing in cwd
const loadEnv = () => {
  if (process.env['OPENROUTER_API_KEY']) return;

  const searchPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), '..', '..', '.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '.env'),
  ];

  for (const envPath of searchPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const envData = fs.readFileSync(envPath, 'utf8');
        envData.split('\n').forEach(line => {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith('#')) return;
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        });
        if (process.env['OPENROUTER_API_KEY']) break;
      }
    } catch (e) {
      // Continue searching
    }
  }
};

loadEnv();

const API_KEY = process.env['OPENROUTER_API_KEY'] || '';

if (!API_KEY) {
  console.error('Hata: OPENROUTER_API_KEY bulunamadı. Lütfen .env dosyasını kontrol edin.');
}

const registry = new ToolRegistry();

// Define Skills
skillRegistry.register({
  name: 'FileSkill',
  description: 'Tools for reading, writing, and searching files.',
  tools: [readFileTool, writeFileTool, replaceTool, listDirectoryTool, grepSearchTool, readManyFilesTool]
});

skillRegistry.register({
  name: 'ShellSkill',
  description: 'Tools for executing terminal commands.',
  tools: [runShellTool]
});

const client = new OpenRouterClient({ 
  apiKey: API_KEY,
  title: 'Codeline CLI',
  model: 'stepfun/step-3.5-flash:free'
});

// Register base tools
registry.register(activateSkillTool(registry));
registry.register(delegateTaskTool(client));
registry.register(connectMcpTool(registry));
registry.register(askUserTool);

// Register default skills to registry
[readFileTool, writeFileTool, replaceTool, listDirectoryTool, grepSearchTool, readManyFilesTool].forEach(t => registry.register(t));
registry.register(runShellTool);

const scheduler = new AgentScheduler(client, registry);
scheduler.setSystemPrompt(SYSTEM_PROMPT + '\n\n' +
  'PERFORMANS VE BAĞLAM:\n' +
  '1. "listDirectory", "readFile", "grepSearch" ve "readManyFiles" araçlarını kullanarak projeyi analiz et.\n' +
  '2. Birden fazla dosyayı analiz etmen gerektiğinde "readManyFiles" aracını kullanarak tek seferde oku.\n' +
  '3. Proje bağlamı sana başlangıçta sunulacaktır, her seferinde sormana gerek yoktur.\n' +
  '4. Karmaşık analizler için "delegateTask" ile alt-agentlar oluştur.\n' +
  '5. SQLite, GitHub gibi harici servisler için "connectMcp" kullan.');

const AVAILABLE_MODELS = [
  'stepfun/step-3.5-flash:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'openai/gpt-4o-mini',
  'openai/gpt-oss-120b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'arcee-ai/trinity-large-preview:free',
  'z-ai/glm-4.5-air:free',
  'google/gemini-2.0-flash-lite-preview-02-05'
];

export const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<AskUserRequest | null>(null);
  const [currentModel, setCurrentModel] = useState(client.getModel());
  const [isChoosingModel, setIsChoosingModel] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();

  useEffect(() => {
    const unsubConfirmation = confirmationBus.subscribe((req) => {
      setPendingConfirmation(req);
    });

    const unsubQuestion = askUserBus.subscribe((req) => {
      setPendingQuestion(req);
      if (req.type === 'choice') {
        setSelectedIndex(0);
      }
    });

    scheduler.loadHistory().then(() => {
      const history = scheduler.getMessages();
      const uiMessages = history
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as any,
          content: typeof m.content === 'string' ? m.content : 'Arac cagiriliyor...',
        }));
      setMessages(uiMessages);
    });

    return () => {
      unsubConfirmation();
      unsubQuestion();
    };
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing || pendingConfirmation) return;

    if (pendingQuestion) {
      if (pendingQuestion.type === 'text') {
        const answer = input;
        setInput('');
        pendingQuestion.resolve(answer);
        setPendingQuestion(null);
      }
      return;
    }

    if (input.trim() === '/model') {
      setIsChoosingModel(true);
      setSelectedIndex(AVAILABLE_MODELS.indexOf(currentModel));
      setInput('');
      return;
    }

    const userInput = input;
    setInput('');
    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'user', content: userInput }]);

    try {
      let currentAssistantMessageIndex = -1;

      await scheduler.process(userInput, (update) => {
        if (update.type === 'content_chunk') {
          if (currentAssistantMessageIndex === -1) {
            setMessages(prev => {
              currentAssistantMessageIndex = prev.length;
              return [...prev, { role: 'assistant', content: update.content }];
            });
          } else {
            setMessages(prev => {
              const next = [...prev];
              next[currentAssistantMessageIndex] = { 
                ...next[currentAssistantMessageIndex], 
                content: update.fullContent 
              };
              return next;
            });
          }
        } else if (update.type === 'thinking') {
          setMessages(prev => [...prev, { role: 'thinking', content: update.content }]);
          currentAssistantMessageIndex = -1;
        } else if (update.type === 'tool_call') {
          setMessages(prev => [...prev, { role: 'tool', content: `Arac: ${update.name}` }]);
        } else if (update.type === 'tool_result') {
          setMessages(prev => [...prev, { role: 'tool', content: `Sonuc (${update.name}): ${update.result.substring(0, 50)}...` }]);
        } else if (update.type === 'confirmation_needed') {
          setMessages(prev => [...prev, { role: 'confirmation', content: `ONAY: ${update.name}` }]);
          currentAssistantMessageIndex = -1;
        }
      });
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Hata: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) exit();

    if (pendingQuestion && pendingQuestion.type === 'choice') {
      if (key.upArrow) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : (pendingQuestion.options?.length || 1) - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => (prev < (pendingQuestion.options?.length || 1) - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const answer = pendingQuestion.options?.[selectedIndex] || '';
        pendingQuestion.resolve(answer);
        setPendingQuestion(null);
      }
      return;
    }

    if (isChoosingModel) {
      if (key.upArrow) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : AVAILABLE_MODELS.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => (prev < AVAILABLE_MODELS.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const newModel = AVAILABLE_MODELS[selectedIndex];
        client.setModel(newModel);
        setCurrentModel(newModel);
        setIsChoosingModel(false);
        setMessages(prev => [...prev, { role: 'assistant', content: `Model degistirildi: ${newModel}` }]);
      } else if (key.escape) {
        setIsChoosingModel(false);
      }
      return;
    }

    if (pendingConfirmation) {
      if (input === 'y' || input === 'Y') {
        pendingConfirmation.resolve('allow');
        setPendingConfirmation(null);
      } else if (input === 'n' || input === 'N') {
        pendingConfirmation.resolve('deny');
        setPendingConfirmation(null);
      } else if (input === 'a' || input === 'A') {
        (pendingConfirmation.resolve as any)('allowAll');
        setPendingConfirmation(null);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">Codeline CLI</Text>
        <Text dimColor>Model: {currentModel}</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Box>
              <Text bold color={
                msg.role === 'user' ? 'green' : 
                msg.role === 'assistant' ? 'blue' : 
                msg.role === 'thinking' ? 'yellow' : 
                msg.role === 'confirmation' ? 'red' :
                'magenta'
              }>
                {msg.role === 'user' ? '❯ ' : '✦ '}
                {msg.role.toUpperCase()}
              </Text>
            </Box>
            <Box paddingLeft={2}>
              {msg.role === 'assistant' ? (
                <MarkdownView text={msg.content} />
              ) : (
                <Text>{msg.content}</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {isChoosingModel && (
        <Box borderStyle="double" borderColor="yellow" flexDirection="column" padding={1} marginBottom={1}>
          <Text bold color="yellow">Model Secin (Ok tuslari ile gezin, Enter ile secin):</Text>
          {AVAILABLE_MODELS.map((model, i) => (
            <Text key={model} color={i === selectedIndex ? 'cyan' : undefined}>
              {i === selectedIndex ? '● ' : '○ '} {model}
            </Text>
          ))}
        </Box>
      )}

      {pendingQuestion && (
        <Box borderStyle="double" borderColor="magenta" flexDirection="column" padding={1} marginBottom={1}>
          <Text bold color="magenta">SORU: {pendingQuestion.question}</Text>
          {pendingQuestion.type === 'choice' && pendingQuestion.options?.map((option, i) => (
            <Text key={option} color={i === selectedIndex ? 'cyan' : undefined}>
              {i === selectedIndex ? '● ' : '○ '} {option}
            </Text>
          ))}
          {pendingQuestion.type === 'text' && (
            <Box>
              <Text color="cyan">Cevap: </Text>
              <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
            </Box>
          )}
        </Box>
      )}

      {pendingConfirmation && (
        <Box borderStyle="double" borderColor="red" padding={1} marginBottom={1} flexDirection="column">
          <Text color="red" bold>ONAY GEREKLİ: {pendingConfirmation.toolName}</Text>
          <Text dimColor>Argümanlar: {JSON.stringify(pendingConfirmation.args).substring(0, 200)}...</Text>
          <Box marginTop={1}>
            <Text bold color="green">[y] İzin Ver</Text>
            <Text> | </Text>
            <Text bold color="red">[n] Reddet</Text>
            <Text> | </Text>
            <Text bold color="yellow">[a] Tümüne İzin Ver (Oturum Boyunca)</Text>
          </Box>
        </Box>
      )}

      {isProcessing && !pendingConfirmation && (
        <Box marginBottom={1}>
          <Text color="yellow" italic>Model calisiyor...</Text>
        </Box>
      )}

      {!pendingConfirmation && !isChoosingModel && (
        <Box>
          <Text color="cyan">Prompt: </Text>
          <TextInput 
            value={input} 
            onChange={setInput} 
            onSubmit={handleSubmit}
            placeholder="Mesajinizi yazin veya /model komutunu kullanin..."
          />
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text dimColor>(Esc: Cikis | /model: Model Degistir)</Text>
      </Box>
    </Box>
  );
};
