import React from 'react';
import '../Styles/ConfirmDialog.css';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div className="cd-overlay" role="dialog" aria-modal="true">
      <div className="cd-modal">
        <div className="cd-header">
          <h4 className="cd-title">{title}</h4>
          <button className="cd-close" aria-label="Close" onClick={onCancel}>×</button>
        </div>
        <div className="cd-body">
          {typeof message === 'string' ? <p className="cd-message">{message}</p> : message}
        </div>
        <div className="cd-actions">
          <button className="cd-btn cd-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button className="cd-btn cd-confirm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
