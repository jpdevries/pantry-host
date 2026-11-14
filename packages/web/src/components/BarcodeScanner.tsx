import { useEffect, useRef, useState, useCallback } from 'react';
import { lookupBarcode, type BarcodeResult } from '@/lib/barcode-lookup';

export interface ScannedProduct extends BarcodeResult {
  barcode: string;
}

interface Props {
  onScan: (product: ScannedProduct) => void;
  onError?: (message: string) => void;
  cooldownMs?: number;
}

export default function BarcodeScanner({ onScan, onError, cooldownMs = 2000 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanned = useRef<Map<string, number>>(new Map());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');

  const handleBarcode = useCallback(
    async (code: string) => {
      const now = Date.now();
      const last = lastScanned.current.get(code);
      if (last && now - last < cooldownMs) return;
      lastScanned.current.set(code, now);

      try {
        const product = await lookupBarcode(code);
        onScan({ barcode: code, ...product });
      } catch {
        onError?.(`Product not found for barcode ${code}`);
      }
    },
    [onScan, onError, cooldownMs],
  );

  useEffect(() => {
    let stopped = false;
    let animFrameId: number;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus('error');
          setCameraError('Camera access is not available. Please ensure you are using HTTPS and a supported browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            focusMode: { ideal: 'continuous' },
            focusDistance: { ideal: 0.3 },
          } as MediaTrackConstraints,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');

        if ('BarcodeDetector' in window) {
          const detector = new (window as unknown as {
            BarcodeDetector: new (opts: { formats: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
            };
          }).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });

          async function scanLoop() {
            if (stopped || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              for (const b of barcodes) {
                await handleBarcode(b.rawValue);
              }
            } catch { /* ignore detection errors */ }
            animFrameId = requestAnimationFrame(scanLoop);
          }
          animFrameId = requestAnimationFrame(scanLoop);
        } else {
          // Fallback: @zxing/browser (Safari has no BarcodeDetector).
          // TRY_HARDER adds a 90°-rotated pass so vertical barcodes scan too;
          // POSSIBLE_FORMATS matches the native path above and keeps that pass cheap.
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ]);
          const hints = new Map<DecodeHintType, unknown>([
            [DecodeHintType.TRY_HARDER, true],
            [DecodeHintType.POSSIBLE_FORMATS, [
              BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE,
            ]],
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          if (videoRef.current) {
            reader.decodeFromVideoElement(videoRef.current, async (result, err) => {
              if (stopped) return;
              if (result) await handleBarcode(result.getText());
              if (err && !(err instanceof Error && err.name === 'NotFoundException')) {
                // NotFoundException is normal when no barcode in frame
              }
            });
          }
          return () => { reader.reset(); };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Camera access denied';
        setCameraError(msg);
        setStatus('error');
        onError?.(msg);
      }
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(animFrameId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [handleBarcode, onError]);

  if (cameraError) {
    return (
      <div role="alert" className="p-4 border border-red-300 text-red-400 text-sm rounded-lg">
        <strong>Camera error:</strong> {cameraError}
      </div>
    );
  }

  return (
    <div className="relative bg-black w-full overflow-hidden" style={{ aspectRatio: '4/3', maxHeight: '40vh' }} aria-label="Camera viewfinder">
      {status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm" aria-live="polite">
          Starting camera…
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        aria-hidden="true"
      />
      <div
        className="absolute inset-8 border-2 border-[var(--color-accent)] opacity-60 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
