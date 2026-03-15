'use client';

import { useState } from 'react';

interface ChatMessageProps {
  content: string;
  senderName: string;
  senderId: string;
  currentUserId: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSizeBytes?: number;
}

export default function ChatMessage({
  content,
  senderName,
  senderId,
  currentUserId,
  timestamp,
  fileUrl,
  fileName,
  fileType,
  fileSizeBytes,
}: ChatMessageProps) {
  const isOwn = senderId === currentUserId;
  const [imageExpanded, setImageExpanded] = useState(false);

  const isImage = fileType?.startsWith('image/');
  const isPdf = fileType === 'application/pdf';

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
        <div
          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'bg-cyan-600 text-white rounded-br-md'
              : 'bg-cardio-800 text-slate-100 rounded-bl-md'
          }`}
        >
          {!isOwn && (
            <p className="text-xs font-semibold text-cyan-400 mb-0.5">
              {senderName}
            </p>
          )}

          {/* File attachment */}
          {fileUrl && isImage && (
            <div className="mb-2">
              <img
                src={fileUrl}
                alt={fileName || 'Image'}
                className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition"
                onClick={() => setImageExpanded(true)}
              />
              {fileName && (
                <p className={`text-[10px] mt-1 ${isOwn ? 'text-cyan-200' : 'text-slate-500'}`}>
                  {fileName} {fileSizeBytes ? `(${formatFileSize(fileSizeBytes)})` : ''}
                </p>
              )}
            </div>
          )}

          {fileUrl && isPdf && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 mb-2 p-2 rounded-lg transition ${
                isOwn
                  ? 'bg-cyan-700/50 hover:bg-cyan-700/70'
                  : 'bg-cardio-800/70 hover:bg-cardio-700/50'
              }`}
            >
              <svg className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${isOwn ? 'text-white' : 'text-slate-200'}`}>
                  {fileName || 'Document PDF'}
                </p>
                {fileSizeBytes && (
                  <p className={`text-[10px] ${isOwn ? 'text-cyan-200' : 'text-slate-400'}`}>
                    PDF - {formatFileSize(fileSizeBytes)}
                  </p>
                )}
              </div>
            </a>
          )}

          {fileUrl && !isImage && !isPdf && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 mb-2 p-2 rounded-lg transition ${
                isOwn
                  ? 'bg-cyan-700/50 hover:bg-cyan-700/70'
                  : 'bg-cardio-800/70 hover:bg-cardio-700/50'
              }`}
            >
              <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${isOwn ? 'text-white' : 'text-slate-200'}`}>
                  {fileName || 'Fichier'}
                </p>
                {fileSizeBytes && (
                  <p className={`text-[10px] ${isOwn ? 'text-cyan-200' : 'text-slate-400'}`}>
                    {formatFileSize(fileSizeBytes)}
                  </p>
                )}
              </div>
            </a>
          )}

          {/* Text content */}
          {content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
          )}
          <p
            className={`text-[10px] mt-1 ${
              isOwn ? 'text-cyan-200' : 'text-slate-500'
            } text-right`}
          >
            {new Date(timestamp).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Image expanded overlay */}
      {imageExpanded && fileUrl && isImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setImageExpanded(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setImageExpanded(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-cardio-800 text-slate-200 flex items-center justify-center shadow-lg hover:bg-cardio-700/50 transition z-10 border border-cyan-500/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={fileUrl}
              alt={fileName || 'Image'}
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
