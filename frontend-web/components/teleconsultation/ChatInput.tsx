'use client';

import { useState, useRef, useCallback } from 'react';
import api from '@/lib/api';

interface ChatInputProps {
  onSend: (content: string, fileData?: { fileUrl: string; fileName: string; fileType: string; fileSizeBytes: number }) => void;
  disabled?: boolean;
  teleconsultationId?: string;
}

export default function ChatInput({ onSend, disabled = false, teleconsultationId }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teleconsultationId) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/teleconsultations/${teleconsultationId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data.data || res.data;
      // Send a message with the file data
      onSend(message.trim() || '', {
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSizeBytes: data.fileSizeBytes,
      });
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('File upload failed:', err);
      alert('Erreur lors de l\'envoi du fichier');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t border-cyan-500/10 bg-cardio-900/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-end gap-2">
        {/* File upload button */}
        {teleconsultationId && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="text-slate-500 hover:text-cyan-400 p-2.5 rounded-xl transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Joindre un fichier"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'La teleconsultation est terminee'
              : uploading
              ? 'Envoi du fichier en cours...'
              : 'Tapez votre message...'
          }
          disabled={disabled || uploading}
          rows={1}
          className="flex-1 resize-none glass-input rounded-xl px-4 py-2.5 text-sm disabled:bg-cardio-800 disabled:text-slate-500 placeholder-slate-500"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || uploading || !message.trim()}
          className="glow-btn p-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
          title="Envoyer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
      {!disabled && !uploading && (
        <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
          Appuyez sur Entree pour envoyer, Maj+Entree pour un saut de ligne
        </p>
      )}
    </div>
  );
}
