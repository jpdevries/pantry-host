/**
 * Accessible modal dialog built on @radix-ui/react-dialog.
 *
 * Provides: focus trapping, Escape key dismiss, body scroll lock,
 * portal rendering, click-outside-to-close, and full ARIA support.
 *
 * Focus return: Radix sends closing focus to a `Dialog.Trigger`, which this
 * component doesn't use, so without help focus would land on <body>. We
 * remember whatever was focused when the dialog opened (the button that
 * opened it) and put focus back there on close; `returnFocusTo` overrides
 * that when the opener isn't the right place to land.
 */
import { useEffect, useRef, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible title — announced by screen readers. */
  title: string;
  children: React.ReactNode;
  /** Full-screen takeover (e.g. Batch Scan) vs centered panel (default). */
  fullScreen?: boolean;
  /** Where focus goes on close. Defaults to the element focused when the
   *  dialog opened. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  fullScreen = false,
  returnFocusTo,
}: ModalProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) openerRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {!fullScreen && (
          <Dialog.Overlay className="fixed inset-0 z-50 bg-body-translucent backdrop-blur-sm" />
        )}
        <Dialog.Content
          className={
            fullScreen
              ? 'fixed inset-0 z-50 bg-body flex flex-col'
              : 'fixed inset-0 z-50 flex items-center justify-center pointer-events-none'
          }
          aria-label={title}
          aria-modal="true"
          onCloseAutoFocus={(event) => {
            const target = returnFocusTo?.current ?? openerRef.current;
            if (target && target !== document.body && document.contains(target)) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {fullScreen ? (
            children
          ) : (
            <div className="bg-body w-full max-w-sm max-h-[85vh] flex flex-col rounded-lg pointer-events-auto shadow-2xl">
              {children}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Dialog };
