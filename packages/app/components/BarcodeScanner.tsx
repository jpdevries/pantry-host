import { useEffect, useRef, useState } from 'react';

import type { ProductMeta } from '@pantry-host/shared/product-meta';

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  /** Per-item size from OFF product_quantity (e.g. 12 fl oz per jar) */
  itemSize?: number;
  itemSizeUnit?: string;
  /** Allowlisted OFF metadata. Always populated when available; the
   *  BatchScanSession decides whether to persist it based on the
   *  STORE_BARCODE_META setting. */
  meta?: ProductMeta;
}

interface Props {
  onScan: (product: ScannedProduct) => void;
  /** `code` is set when the error is about one barcode's lookup. */
  onError?: (message: string, code?: string) => void;
  /** Called the moment a barcode is read, before the network lookup, so the
   *  parent can show it as pending. Return false to skip the lookup (e.g. the
   *  barcode is already in the list). */
  onDetect?: (code: string) => boolean | void;
  cooldownMs?: number;
}


/**
 * BarcodeScanner — uses native BarcodeDetector API where available,
 * falls back to @zxing/browser. Camera stream persists until unmounted.
 */
export default function BarcodeScanner({ onScan, onError, onDetect, cooldownMs = 2000 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanned = useRef<Map<string, number>>(new Map());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  // Codes whose lookup is running, so a re-read during a slow lookup doesn't
  // start a second one.
  const inFlight = useRef<Set<string>>(new Set());
  // The code just read: drives the solid frame + "Read …" chip for ~1.2s.
  const [lastRead, setLastRead] = useState<string | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(readTimer.current), []);

  function signalRead(code: string) {
    setLastRead(code);
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => setLastRead(null), 1200);
  }


  // Pin callbacks + cooldown via refs so the camera-lifecycle effect can
  // depend on []. Without this, parents passing inline onScan/onError (the
  // common case) would re-create the camera on every render — and when
  // start() fails synchronously (e.g. insecure HTTP context where
  // navigator.mediaDevices is undefined) the resulting setState→re-render
  // becomes an infinite loop and crashes React with #185.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const onDetectRef = useRef(onDetect);
  const cooldownRef = useRef(cooldownMs);
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
    onDetectRef.current = onDetect;
    cooldownRef.current = cooldownMs;
  });

  useEffect(() => {
    let stopped = false;
    let animFrameId: number;

    async function handleBarcode(code: string) {
      const now = Date.now();
      const last = lastScanned.current.get(code);
      if (last && now - last < cooldownRef.current) return; // cooldown
      lastScanned.current.set(code, now);
      if (inFlight.current.has(code)) return; // its lookup is still running
      if (onDetectRef.current?.(code) === false) return; // parent: skip it

      // Feedback before the network call: the user can move on as soon as
      // they see/hear this, because the lookup no longer needs the camera.
      inFlight.current.add(code);
      signalRead(code);

      try {
        const res = await fetch(`/api/lookup-barcode?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          const json = await res.json() as { error: string };
          onErrorRef.current?.(`Product not found for barcode ${code}: ${json.error}`, code);
          return;
        }
        const product = await res.json() as { name: string; brand?: string; category?: string; quantity?: number; unit?: string; itemSize?: number; itemSizeUnit?: string; meta?: ProductMeta };
        onScanRef.current({ barcode: code, ...product });
      } catch {
        onErrorRef.current?.(`Failed to look up barcode ${code}`, code);
      } finally {
        inFlight.current.delete(code);
      }
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus('error');
          onErrorRef.current?.('Camera access is not available. Please ensure you are using HTTPS and a supported browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            focusMode: { ideal: 'continuous' },
            focusDistance: { ideal: 0.3 },  // ~1 foot for close-up barcode scanning
          } as MediaTrackConstraints,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');

        // Try native BarcodeDetector
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
          // Cleanup zxing on stop
          return () => {
            reader.reset();
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Camera access denied';
        setCameraError(msg);
        setStatus('error');
        onErrorRef.current?.(msg);
      }
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(animFrameId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  if (cameraError) {
    return (
      <div role="alert" className="p-4 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
        <strong>Camera error:</strong> {cameraError}
      </div>
    );
  }

  return (
    <div className="relative bg-black aspect-[4/3] w-full overflow-hidden" aria-label="Camera viewfinder">
      {status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm" aria-live="polite">
          Starting camera…
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
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
        className={`absolute inset-8 pointer-events-none motion-safe:transition-all motion-safe:duration-150 ${lastRead ? 'border-4 border-green-400 bg-green-400/15 opacity-100' : 'border-2 border-accent opacity-60'}`}
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
