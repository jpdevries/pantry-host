import { useEffect, useRef, useState, useCallback } from 'react';
import { Flashlight } from '@phosphor-icons/react';
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
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false); // advertised but refused: hide the button
    }
  }

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

        // Flashlight: only offered where the camera says it has one. The
        // system flashlight can't be used while a page holds the camera.
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        if (caps.torch) setTorchSupported(true);

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
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
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
      {status === 'ready' && torchSupported && (
        <button
          type="button"
          onClick={toggleTorch}
          aria-pressed={torchOn}
          aria-label="Flashlight"
          className={`absolute top-2 right-2 p-2 ${torchOn ? 'bg-white text-black' : 'bg-black/60 text-white'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring-focus)]`}
        >
          <Flashlight size={22} weight={torchOn ? 'fill' : 'regular'} aria-hidden />
        </button>
      )}
    </div>
  );
}
