import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Upload, X, CheckCircle, AlertCircle, Loader2, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import api from '../lib/api';
import { cn } from '../lib/utils';

interface Document {
  id: number;
  name: string;
  filename: string;
  mime_type: string;
  size: number;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
}

interface RAGDocumentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RAGDocumentsPanel: React.FC<RAGDocumentsPanelProps> = ({ isOpen, onClose }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ['.txt', '.pdf', '.doc', '.docx'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const response = await api.get('/rag/documents');
      const docs = response.data.documents || [];
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, loadDocuments]);

  // Poll for document status updates when panel is open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const processingDocs = documents.filter(d => d.status === 'processing');
      if (processingDocs.length > 0) {
        loadDocuments();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [isOpen, documents, loadDocuments]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Check if the click is not on the button that opens this panel
        const target = event.target as HTMLElement;
        if (!target.closest('[data-rag-button]')) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      return `File type ${extension} is not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    if (file.size > maxSize) {
      return `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
    }
    return null;
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await api.post('/rag/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reload documents list
      await loadDocuments();
      
      // Poll for document status if it's processing
      if (response.data.document.status === 'processing') {
        pollDocumentStatus(response.data.document.id);
      }
    } catch (error: any) {
      setUploadError(error.response?.data?.error || 'Failed to upload document');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const pollDocumentStatus = async (documentId: number) => {
    const maxAttempts = 30;
    let attempts = 0;
    
    const interval = setInterval(async () => {
      attempts++;
      try {
        const response = await api.get('/rag/documents');
        const docs = response.data.documents || [];
        const doc = docs.find((d: Document) => d.id === documentId);
        
        if (doc && (doc.status === 'ready' || doc.status === 'failed')) {
          clearInterval(interval);
          await loadDocuments(); // Refresh the list
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to check document status:', error);
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  };

  const handleDelete = async (documentId: number) => {
    try {
      await api.delete(`/rag/documents/${documentId}`);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          'fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      
      {/* Panel - positioned at bottom, expanding upward */}
      <div
        ref={panelRef}
        className={cn(
          'fixed left-4 right-4 bottom-24 max-w-md mx-auto z-50 transform transition-all duration-300 ease-out',
          isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        )}
      >
        <Card className="bg-surface1 border-surface2 shadow-xl max-h-[60vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface2">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-text">RAG Documents</h3>
              <span className="text-xs text-subtext0 bg-surface0 px-2 py-0.5 rounded">
                {documents.filter(d => d.status === 'ready').length} ready
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-subtext0 hover:text-text"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-surface2 rounded-lg p-4 hover:border-accent transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="flex flex-col items-center justify-center space-y-3">
                <Upload className={`w-8 h-8 ${uploading ? 'text-accent animate-pulse' : 'text-subtext0'}`} />
                <div className="text-center">
                  <p className="text-text font-medium text-sm mb-1">
                    {uploading ? 'Uploading...' : 'Upload Document'}
                  </p>
                  <p className="text-xs text-subtext0">
                    TXT, PDF, DOC, DOCX (Max 10MB)
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  size="sm"
                  className="bg-accent hover:bg-accent/80 text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Choose File
                    </>
                  )}
                </Button>
              </div>

              {uploadError && (
                <div className="mt-3 p-2 bg-red/10 border border-red/20 rounded text-red text-xs">
                  {uploadError}
                </div>
              )}
            </div>

            {/* Documents List */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-text mb-2">Uploaded Documents</h4>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-surface0 rounded border border-surface2 hover:border-overlay1 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getStatusIcon(doc.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-subtext0">
                          {formatFileSize(doc.size)} • {doc.status}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-red hover:text-red/80 hover:bg-red/10 ml-2 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {documents.length === 0 && !loadingDocuments && (
              <div className="text-center py-8 text-subtext0">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No documents uploaded yet</p>
                <p className="text-xs mt-1">Upload a document to enable RAG functionality</p>
              </div>
            )}

            {loadingDocuments && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-surface2 bg-surface0">
            <p className="text-xs text-subtext0 text-center">
              Documents are automatically searched when you ask questions
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default RAGDocumentsPanel;

