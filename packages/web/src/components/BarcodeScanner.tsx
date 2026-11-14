import { useEffect, useRef, useState, useCallback } from 'react';
import { lookupBarcode, type BarcodeResult } from '@/lib/barcode-lookup';

export interface ScannedProduct extends BarcodeResult {
  barcode: string;
}

interface Props {
  onScan: (product: ScannedProduct) => void;
  /** `code` is set when the error is about one barcode's lookup. */
  onError?: (message: string, code?: string) => void;
  /** Called the moment a barcode is read, before the lookup, so the parent can
   *  show it as pending. Return false to skip the lookup (already in the list). */
  onDetect?: (code: string) => boolean | void;
  cooldownMs?: number;
}

export default function BarcodeScanner({ onScan, onError, onDetect, cooldownMs = 2000 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanned = useRef<Map<string, number>>(new Map());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  // Codes whose lookup is running, so a re-read during a slow lookup doesn't
  // start a second one.
  const inFlight = useRef<Set<string>>(new Set());
  // The code just read: drives the green frame + "Read …" chip for ~1.2s.
  const [lastRead, setLastRead] = useState<string | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(readTimer.current), []);
  // Read through a ref so a new onDetect doesn't recreate handleBarcode (which
  // would restart the camera).
  const onDetectRef = useRef(onDetect);
  useEffect(() => { onDetectRef.current = onDetect; });

  const handleBarcode = useCallback(
    async (code: string) => {
      const now = Date.now();
      const last = lastScanned.current.get(code);
      if (last && now - last < cooldownMs) return;
      lastScanned.current.set(code, now);
      if (inFlight.current.has(code)) return; // its lookup is still running
      if (onDetectRef.current?.(code) === false) return; // parent: skip it

      // Feedback before the lookup: the user can move on as soon as they see
      // this, because the lookup no longer needs the camera.
      inFlight.current.add(code);
      setLastRead(code);
      clearTimeout(readTimer.current);
      readTimer.current = setTimeout(() => setLastRead(null), 1200);

      try {
        const product = await lookupBarcode(code);
        onScan({ barcode: code, ...product });
      } catch {
        onError?.(`Product not found for barcode ${code}`, code);
      } finally {
        inFlight.current.delete(code);
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
      {/* Scan guide overlay: turns green the moment a barcode is read. Green
          rather than the accent token, which is near-white in dark mode and
          doesn't read as a change against the camera feed. */}
      <div
        className={`absolute inset-8 pointer-events-none motion-safe:transition-all motion-safe:duration-150 ${lastRead ? 'border-4 border-green-400 bg-green-400/15 opacity-100' : 'border-2 border-[var(--color-accent)] opacity-60'}`}
        aria-hidden="true"
      />
      {lastRead && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none" aria-hidden="true">
          <span className="bg-black/70 text-white text-sm px-3 py-1">✓ Read {lastRead}</span>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{lastRead ? `Barcode read: ${lastRead}` : ''}</p>
    </div>
  );
}
