'use client';

import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSizeBytes?: number;
}

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  loading?: boolean;
}

export default function ChatWindow({
  messages,
  currentUserId,
  loading = false,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 bg-cardio-800/50"
    >
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-500 text-sm">Chargement des messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-slate-500 mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">
              Aucun message pour le moment.
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Commencez la conversation ci-dessous.
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              content={msg.content}
              senderName={msg.senderName}
              senderId={msg.senderId}
              currentUserId={currentUserId}
              timestamp={msg.createdAt}
              fileUrl={msg.fileUrl}
              fileName={msg.fileName}
              fileType={msg.fileType}
              fileSizeBytes={msg.fileSizeBytes}
            />
          ))}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  );
}
