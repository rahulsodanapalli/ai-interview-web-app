import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { formatFileSize } from '../../utils/format';
import { UploadIcon, FileTextIcon, XIcon, CheckCircleIcon, AlertCircleIcon } from '../ui/Icons';
import './PDFUpload.css';

interface PDFUploadProps {
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
  externalError?: string | null;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB backend limit

export default function PDFUpload({
  selectedFile,
  onFileSelected,
  disabled = false,
  externalError,
}: PDFUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayError = validationError || externalError || null;

  function validateFile(file: File): string | null {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      return 'Only PDF documents (.pdf) are supported.';
    }
    if (file.size === 0) {
      return 'The selected PDF file is empty (0 bytes). Please choose a valid document.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File size (${formatFileSize(file.size)}) exceeds the 10 MB maximum limit.`;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) {
      setValidationError(err);
      onFileSelected(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setValidationError(null);
    onFileSelected(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setValidationError(null);
    onFileSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openPicker() {
    if (!disabled) fileInputRef.current?.click();
  }

  return (
    <div className="pdf-upload-root" id="pdf-upload-section">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="visually-hidden"
        id="pdf-file-input"
        disabled={disabled}
      />

      {selectedFile ? (
        <div className="selected-file-box" id="selected-file-card">
          <div className="selected-file-main">
            <div className="selected-file-icon-wrap" aria-hidden="true">
              <FileTextIcon size={20} />
            </div>
            <div className="selected-file-meta">
              <div className="selected-file-name-row">
                <span className="selected-file-name" id="selected-file-name" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
                <span className="badge badge-success">
                  <CheckCircleIcon size={12} />
                  <span>Ready</span>
                </span>
              </div>
              <span className="selected-file-size" id="selected-file-size">
                {formatFileSize(selectedFile.size)} · PDF document
              </span>
            </div>
          </div>

          <div className="selected-file-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={openPicker}
              disabled={disabled}
              id="choose-different-file-btn"
            >
              Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleRemove}
              disabled={disabled}
              id="clear-selected-file-btn"
              aria-label="Remove selected file"
            >
              <XIcon size={14} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload PDF document. Drag and drop or press Enter to browse files."
          aria-disabled={disabled}
          className={`pdf-dropzone ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              openPicker();
            }
          }}
          id="pdf-dropzone"
        >
          <div className="dropzone-icon-wrap" aria-hidden="true">
            <UploadIcon size={20} />
          </div>
          <div className="dropzone-copy">
            <p className="dropzone-headline">
              Drop your PDF here, or <span className="dropzone-browse-link">browse files</span>
            </p>
            <p className="dropzone-constraints">
              Supported format: <strong>PDF (.pdf)</strong> · Max file size: <strong>10 MB</strong>
            </p>
          </div>
        </div>
      )}

      {displayError && (
        <div className="pdf-validation-alert" role="alert" id="pdf-upload-error">
          <AlertCircleIcon size={15} />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}
