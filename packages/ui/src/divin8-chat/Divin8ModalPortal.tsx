import { useEffect, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { classNames } from "./utils";

interface Divin8ModalPortalProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdropClick?: boolean;
  overlayClassName?: string;
}

let activeModalLocks = 0;

function lockModalBodyScroll() {
  if (typeof document === "undefined") {
    return;
  }
  activeModalLocks += 1;
  document.body.classList.add("modal-open");
}

function unlockModalBodyScroll() {
  if (typeof document === "undefined") {
    return;
  }
  activeModalLocks = Math.max(0, activeModalLocks - 1);
  if (activeModalLocks === 0) {
    document.body.classList.remove("modal-open");
  }
}

export default function Divin8ModalPortal({
  open,
  children,
  onClose,
  closeOnBackdropClick = false,
  overlayClassName,
}: Divin8ModalPortalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    lockModalBodyScroll();
    return () => unlockModalBodyScroll();
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (!closeOnBackdropClick || event.target !== event.currentTarget) {
      return;
    }
    onClose?.();
  }

  return createPortal(
    <div
      className={classNames("ui-modal-overlay", overlayClassName)}
      onMouseDown={handleBackdropMouseDown}
    >
      {children}
    </div>,
    document.body,
  );
}
