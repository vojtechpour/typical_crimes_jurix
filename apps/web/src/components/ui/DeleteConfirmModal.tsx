import React, { useEffect } from "react";

type DeleteConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  warningMessage?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
};

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  warningMessage,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDeleting = false,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    if (isOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, isDeleting]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 999,
          backdropFilter: "blur(4px)",
        }}
        onClick={() => !isDeleting && onClose()}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "rgb(26, 26, 26)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "500px",
          width: "90%",
          zIndex: 1000,
          boxShadow: "rgba(0, 0, 0, 0.5) 0px 24px 48px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "2px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0px auto 24px",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "rgb(255, 255, 255)",
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "14px",
            lineHeight: "1.6",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          {description}
        </p>

        {/* Warning box (optional) */}
        {warningMessage && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "rgb(252, 165, 165)",
                fontSize: "13px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{warningMessage}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn subtle"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              minWidth: "100px",
            }}
          >
            {cancelText}
          </button>
          <button
            className="btn danger"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              minWidth: "100px",
              backgroundColor: "rgb(239, 68, 68)",
              color: "rgb(255, 255, 255)",
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
};

export default DeleteConfirmModal;
