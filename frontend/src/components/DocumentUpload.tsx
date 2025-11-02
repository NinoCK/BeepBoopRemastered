import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import api from '../lib/api';

interface Document {
  id: number;
  name: string;
  filename: string;
  mime_type: string;
  size: number;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
}

interface DocumentUploadProps {
  onUploadComplete?: () => void;
  onDocumentsChange?: (documents: Document[]) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploadComplete, onDocumentsChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const acceptedTypes = ['.txt', '.pdf', '.doc', '.docx'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const response = await api.get('/rag/documents');
      const docs = response.data.documents || [];
      setDocuments(docs);
      onDocumentsChange?.(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, [onDocumentsChange]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
      
      onUploadComplete?.();
      
      // Poll for document status if it's processing
      if (response.data.document.status === 'processing') {
        pollDocumentStatus(response.data.document.id);
      }
    } catch (error: any) {
      setUploadError(error.response?.data?.error || 'Failed to upload document');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
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
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card className={`p-6 border-2 border-dashed transition-colors ${
        isDragging 
          ? 'border-accent bg-accent/10' 
          : 'border-surface2 bg-surface0'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="w-12 h-12 text-subtext0" />
          <div className="text-center">
            <p className="text-text font-medium mb-1">
              {uploading ? 'Uploading...' : 'Upload Document'}
            </p>
            <p className="text-sm text-subtext0">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-xs text-subtext1 mt-1">
              Supported: TXT, PDF, DOC, DOCX (Max 10MB)
            </p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
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
                Select File
              </>
            )}
          </Button>
        </div>

        {uploadError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            {uploadError}
          </div>
        )}
      </Card>

      {/* Documents List */}
      {documents.length > 0 && (
        <Card className="p-4">
          <h3 className="text-text font-semibold mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-surface0 rounded border border-surface2"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getStatusIcon(doc.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-subtext0">
                      {formatFileSize(doc.size)} • {doc.status}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loadingDocuments && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;

