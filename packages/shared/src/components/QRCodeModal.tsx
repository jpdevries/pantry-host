/**
 * QR Code modal — generates QR codes entirely client-side using the
 * `qrcode` npm package. No network requests. Renders as inline SVG
 * for crisp display at any size, downloadable as .svg.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, DownloadSimple, Check } from '@phosphor-icons/react';

interface QRCodeModalProps {
  url: string;
  open: boolean;
  onClose: () => void;
}

export default function QRCodeModal({ url, open, onClose }: QRCodeModalProps) {
  const [svgMarkup, setSvgMarkup] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setSvgMarkup);
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = 'recipe-qr.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Share recipe QR code"
    >
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Share Recipe</h2>
          <button onClick={onClose} className="p-1 hover:underline" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div
          className="flex justify-center mb-4 [&>svg]:w-64 [&>svg]:h-64 [&>svg]:rounded-lg"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />

        <p className="text-xs text-[var(--color-text-secondary)] text-center mb-4 break-all">
          {url}
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          <button
            onClick={handleDownload}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <DownloadSimple size={16} />
            Download SVG
          </button>
        </div>
      </div>
    </div>
  );
}
