'use client';
import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: '#0f2035',
          color: '#f0f9ff',
          border: '1px solid rgba(6,182,212,0.15)',
        },
      }}
    />
  );
}
