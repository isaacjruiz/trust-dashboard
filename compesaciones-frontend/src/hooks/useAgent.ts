import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import type { ChatMessage } from '../types';

const BASE = '';

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'agent',
      content: '¡Hola! Soy el Agente de Trust & Safety de Rappi. Puedo ayudarte a revisar casos de compensación, detectar patrones de fraude y generar reportes.\n\n¿En qué te puedo ayudar hoy?',
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [threadId] = useState(`thread-${Date.now()}`);

  // Ref to always read the latest messages inside the stable sendMessage callback
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Use ref to get current messages — avoids stale closure in useCallback
      const history = messagesRef.current
        .filter((m) => m.role === 'user' || m.role === 'agent')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

      const res = await axios.post<{ response: string; threadId: string }>(
        `${BASE}/agent/chat`,
        { message: content, history, threadId }
      );

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: res.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, agentMsg]);
      return res.data.response;
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  const clearMessages = useCallback(() => {
    setMessages([{
      id: '0',
      role: 'agent',
      content: '¡Hola! ¿En qué te puedo ayudar?',
      timestamp: new Date(),
    }]);
  }, []);

  return { messages, loading, sendMessage, clearMessages };
}
