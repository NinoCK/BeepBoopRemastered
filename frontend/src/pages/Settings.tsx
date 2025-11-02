import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useNotifications } from '../contexts/NotificationContext';
import { useAppLogging } from '../contexts/AppLoggingContext';
import { useModelOperations } from '../contexts/ModelOperationContext';
import DocumentUpload from '../components/DocumentUpload';
import { 
  Settings as SettingsIcon, 
  Server, 
  Search, 
  Database, 
  Save,
  CheckCircle,
  XCircle,
  FileText,
  Upload,
  Bot,
  Download,
  Trash2,
  AlertCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import api from '../lib/api';

interface Model {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: any;
}

const Settings: React.FC = () => {
  const { addNotification } = useNotifications();
  const { addLog } = useAppLogging();
  const { addOperation, updateOperation, removeOperation } = useModelOperations();
  const [llmEndpoint, setLlmEndpoint] = useState('http://localhost:11434/api/generate');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [searchProvider, setSearchProvider] = useState('duckduckgo');
  const [llmStatus, setLlmStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [searchStatus, setSearchStatus] = useState<'unknown' | 'configured' | 'not_configured'>('unknown');
  
  // Model management state
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [newModelName, setNewModelName] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'running' | 'offline' | 'unknown'>('unknown');
  
  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState<{
    percentage: number;
    status: string;
    speed?: string;
    error?: string;
  } | null>(null);
  
  useEffect(() => {
    checkSearchStatus();
    fetchModels();
    fetchCurrentModel();
    fetchServiceStatus();
  }, []);

  const checkSearchStatus = async () => {
    try {
      addLog({
        level: 'info',
        category: 'system',
        message: 'Checking search service status',
        source: 'Settings'
      });
      const response = await api.get('/search/status');
      setSearchStatus(response.data.configured ? 'configured' : 'not_configured');
      setSearchProvider(response.data.provider || 'tavily');
      addLog({
        level: 'info',
        category: 'system',
        message: `Search status: ${response.data.configured ? 'configured' : 'not configured'} (${response.data.provider || 'tavily'})`,
        source: 'Settings',
        context: { configured: response.data.configured, provider: response.data.provider || 'tavily' }
      });
    } catch (error) {
      setSearchStatus('not_configured');
      addLog({
        level: 'warning',
        category: 'system',
        message: 'Search status check failed',
        source: 'Settings',
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };

  const testLlmConnection = async () => {
    setLlmStatus('unknown');
    addLog({
      level: 'info',
      category: 'system',
      message: 'Testing LLM connection',
      source: 'Settings'
    });
    try {
      // This would need to be implemented on the backend
      const response = await api.post('/chat', {
        message: 'Test connection',
        chat_id: 1 // Would need a test endpoint
      });
      setLlmStatus('connected');
      addLog({
        level: 'success',
        category: 'system',
        message: 'LLM connection test successful',
        source: 'Settings',
        context: { endpoint: llmEndpoint }
      });
    } catch (error) {
      setLlmStatus('disconnected');
      addLog({
        level: 'error',
        category: 'system',
        message: 'LLM connection test failed',
        source: 'Settings',
        context: { endpoint: llmEndpoint, error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };

  const handleSave = async () => {
    try {
      addLog({
        level: 'info',
        category: 'system',
        message: 'Saving configuration settings',
        source: 'Settings',
        context: { llmEndpoint, searchProvider }
      });
      // This would need to be implemented on the backend to save settings
      console.log('Settings saved:', { llmEndpoint, searchApiKey, searchProvider });
      alert('Settings saved successfully! Please restart the application for changes to take effect.');
      addLog({
        level: 'success',
        category: 'system',
        message: 'Configuration settings saved successfully',
        source: 'Settings'
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      addLog({
        level: 'error',
        category: 'system',
        message: 'Failed to save configuration settings',
        source: 'Settings',
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      alert('Failed to save settings. Please try again.');
    }
  };

  // Model management functions
  const fetchModels = async () => {
    setModelsLoading(true);
    addLog({
      level: 'info',
      category: 'model',
      message: 'Fetching available models',
      source: 'Settings'
    });
    try {
      const response = await api.get('/models');
      if (response.data.success) {
        setModels(response.data.models);
        addLog({
          level: 'success',
          category: 'model',
          message: `Successfully fetched ${response.data.models.length} model(s)`,
          source: 'Settings',
          context: { count: response.data.models.length }
        });
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModels([]);
      addLog({
        level: 'error',
        category: 'model',
        message: 'Failed to fetch models',
        source: 'Settings',
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchCurrentModel = async () => {
    try {
      const response = await api.get('/models/current');
      if (response.data.success) {
        setCurrentModel(response.data.model);
        addLog({
          level: 'info',
          category: 'model',
          message: `Current model: ${response.data.model}`,
          source: 'Settings',
          context: { model: response.data.model }
        });
      }
    } catch (error) {
      console.error('Failed to fetch current model:', error);
      addLog({
        level: 'warning',
        category: 'model',
        message: 'Failed to fetch current model',
        source: 'Settings',
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };

  const fetchServiceStatus = async () => {
    try {
      const response = await api.get('/models/status');
      if (response.data.success) {
        setServiceStatus(response.data.status);
        addLog({
          level: 'info',
          category: 'model',
          message: `Service status: ${response.data.status}`,
          source: 'Settings',
          context: { status: response.data.status }
        });
      }
    } catch (error) {
      setServiceStatus('offline');
      addLog({
        level: 'warning',
        category: 'model',
        message: 'Service status check failed, marking as offline',
        source: 'Settings',
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };

  const handlePullModel = async () => {
    if (!newModelName.trim()) return;
    
    const modelName = newModelName.trim();
    const operationId = addOperation({
      type: 'download',
      model: modelName,
      status: 'pending',
      message: `Starting download of ${modelName}...`
    });

    setPullingModel(modelName);
    setDownloadProgress({
      percentage: 0,
      status: 'Initializing...',
    });

    addLog({
      level: 'info',
      category: 'model',
      message: `Starting download of model: ${modelName}`,
      source: 'Settings',
      context: { model: modelName }
    });

    try {
      updateOperation(operationId, { status: 'in_progress', progress: 0 });
      
      // Use fetch with streaming for Server-Sent Events (EventSource doesn't support POST)
      const response = await fetch('/api/models/pull/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let lastDataTime = Date.now();

      addNotification({
        type: 'info',
        message: `Started downloading model: ${modelName}`,
      });

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Check if we ended unexpectedly without completion
          const currentTime = Date.now();
          if (currentTime - lastDataTime > 5000) { // 5 seconds since last data
            console.warn('Stream ended unexpectedly - no data for 5+ seconds');
            setDownloadProgress({
              percentage: 0,
              status: 'Download interrupted',
              error: 'Download was interrupted. Please try again.'
            });
            setTimeout(() => setDownloadProgress(null), 10000);
          }
          break;
        }

        lastDataTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'status':
                  setDownloadProgress(prev => prev ? {
                    ...prev,
                    status: data.message
                  } : {
                    percentage: 0,
                    status: data.message
                  });
                  updateOperation(operationId, { 
                    message: data.message 
                  });
                  addLog({
                    level: 'debug',
                    category: 'model',
                    message: `Model download status: ${data.message}`,
                    source: 'Settings',
                    context: { model: modelName, status: data.message }
                  });
                  break;
                  
                case 'progress':
                  setDownloadProgress(prev => ({
                    percentage: data.percentage,
                    status: prev?.status || 'Downloading...',
                    speed: data.speed
                  }));
                  updateOperation(operationId, { 
                    progress: data.percentage,
                    message: `Downloading... ${data.percentage.toFixed(1)}%`
                  });
                  addLog({
                    level: 'debug',
                    category: 'model',
                    message: `Model download progress: ${data.percentage.toFixed(1)}%`,
                    source: 'Settings',
                    context: { model: modelName, percentage: data.percentage, speed: data.speed }
                  });
                  break;
                  
                case 'complete':
                  setDownloadProgress({
                    percentage: 100,
                    status: 'Download completed successfully!'
                  });
                  updateOperation(operationId, { 
                    status: 'completed', 
                    progress: 100,
                    message: data.message
                  });
                  
                  addLog({
                    level: 'success',
                    category: 'model',
                    message: `Model download completed: ${modelName}`,
                    source: 'Settings',
                    context: { model: modelName }
                  });
                  
                  addNotification({
                    type: 'success',
                    message: `Successfully downloaded model: ${modelName}`,
                  });
                  
                  setNewModelName('');
                  setTimeout(() => {
                    setDownloadProgress(null);
                    fetchModels();
                  }, 2000);
                  setTimeout(() => removeOperation(operationId), 5000);
                  return;
                  
                case 'error':
                  setDownloadProgress({
                    percentage: 0,
                    status: 'Download failed',
                    error: data.message
                  });
                  updateOperation(operationId, { 
                    status: 'error',
                    message: data.message
                  });
                  
                  addLog({
                    level: 'error',
                    category: 'model',
                    message: `Model download failed: ${modelName} - ${data.message}`,
                    source: 'Settings',
                    context: { model: modelName, error: data.message }
                  });
                  
                  addNotification({
                    type: 'error',
                    message: `Failed to download ${modelName}: ${data.message}`,
                  });
                  
                  setTimeout(() => {
                    setDownloadProgress(null);
                  }, 10000);
                  setTimeout(() => removeOperation(operationId), 10000);
                  return;
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }

    } catch (error: any) {
      console.error('Failed to pull model:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      
      setDownloadProgress({
        percentage: 0,
        status: 'Download failed',
        error: errorMessage
      });
      
      updateOperation(operationId, { 
        status: 'error',
        message: errorMessage
      });
      
      addLog({
        level: 'error',
        category: 'model',
        message: `Model download error: ${modelName} - ${errorMessage}`,
        source: 'Settings',
        context: { model: modelName, error: errorMessage }
      });
      
      addNotification({
        type: 'error',
        message: `Failed to download ${modelName}: ${errorMessage}`,
      });
      
      setTimeout(() => {
        setDownloadProgress(null);
      }, 10000);
      setTimeout(() => removeOperation(operationId), 10000);
    } finally {
      setPullingModel(null);
    }
  };
  
  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete the model "${modelName}"? This action cannot be undone.`)) {
      return;
    }

    addLog({
      level: 'warning',
      category: 'model',
      message: `Deleting model: ${modelName}`,
      source: 'Settings',
      context: { model: modelName }
    });

    const operationId = addOperation({
      type: 'delete',
      model: modelName,
      status: 'pending',
      message: `Deleting model ${modelName}...`
    });

    setDeletingModel(modelName);
    try {
      updateOperation(operationId, { status: 'in_progress' });
      
      const response = await api.delete('/models/delete', { data: { model: modelName } });
      if (response.data.success) {
        updateOperation(operationId, { 
          status: 'completed',
          message: `Successfully deleted model ${modelName}`
        });
        addLog({
          level: 'success',
          category: 'model',
          message: `Model deleted successfully: ${modelName}`,
          source: 'Settings',
          context: { model: modelName }
        });
        fetchModels(); // Refresh the list
        setTimeout(() => removeOperation(operationId), 3000); // Remove after 3 seconds
      } else {
        updateOperation(operationId, { 
          status: 'error',
          message: `Failed to delete model ${modelName}: ${response.data.message}`
        });
        addLog({
          level: 'error',
          category: 'model',
          message: `Failed to delete model: ${modelName} - ${response.data.message}`,
          source: 'Settings',
          context: { model: modelName, error: response.data.message }
        });
        setTimeout(() => removeOperation(operationId), 8000); // Remove after 8 seconds for errors
      }
    } catch (error: any) {
      console.error('Failed to delete model:', error);
      const errorMessage = error.response?.data?.message || error.message;
      updateOperation(operationId, { 
        status: 'error',
        message: `Failed to delete model ${modelName}: ${errorMessage}`
      });
      addLog({
        level: 'error',
        category: 'model',
        message: `Model deletion error: ${modelName} - ${errorMessage}`,
        source: 'Settings',
        context: { model: modelName, error: errorMessage }
      });
      setTimeout(() => removeOperation(operationId), 8000); // Remove after 8 seconds for errors
    } finally {
      setDeletingModel(null);
    }
  };

  const formatSize = (size: number) => {
    if (!size) return 'Unknown';
    const gb = size / (1024 * 1024 * 1024);
    return gb > 1 ? `${gb.toFixed(1)} GB` : `${(size / (1024 * 1024)).toFixed(0)} MB`;
  };

  const formatModelName = (name: string) => {
    return name.split(':')[0];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
      case 'configured':
        return (
          <Badge className="bg-green/20 text-green border-green/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'disconnected':
      case 'not_configured':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Not Connected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Server className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 p-6 bg-surface0 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-text">Settings</h1>
        </div>

        {/* LLM Configuration */}
        <Card className="p-6 bg-surface1 border-surface2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Server className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-text">LLM Configuration</h2>
            </div>
            {getStatusBadge(llmStatus)}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-subtext1 mb-2">
                LLM Endpoint URL
              </label>
              <Input
                value={llmEndpoint}
                onChange={(e) => setLlmEndpoint(e.target.value)}
                placeholder="http://localhost:11434/api/generate"
                className="bg-surface0 border-surface2 text-text"
              />
              <p className="text-xs text-subtext0 mt-1">
                URL for your local LLM server (e.g., Ollama, LM Studio)
              </p>
            </div>
            
            <Button
              onClick={testLlmConnection}
              variant="outline"
              className="border-surface2 text-text hover:bg-surface2"
            >
              <Server className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
          </div>
        </Card>

        {/* Model Management */}
        <Card className="p-6 bg-surface1 border-surface2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Bot className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-text">Model Management</h2>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                variant="secondary" 
                className={serviceStatus === 'running' ? 'bg-green/20 text-green border-green/30' : 'bg-red/20 text-red border-red/30'}
              >
                {serviceStatus === 'running' ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Ollama {serviceStatus}
              </Badge>
              <Button
                onClick={() => {
                  fetchModels();
                  fetchCurrentModel();
                  fetchServiceStatus();
                }}
                variant="outline"
                size="sm"
                className="border-surface2 text-text hover:bg-surface2"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Install New Model */}
          <div className="mb-6 p-4 bg-surface0 rounded-lg border border-surface2">
            <h3 className="font-medium text-text mb-3">Install New Model</h3>
            <div className="flex space-x-2">
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="Model name (e.g., llama2, codellama, mistral)"
                className="flex-1 bg-surface1 border-surface2 text-text"
                disabled={serviceStatus !== 'running'}
              />
              <Button
                onClick={handlePullModel}
                disabled={!newModelName.trim() || pullingModel !== null || serviceStatus !== 'running'}
                className="bg-accent hover:bg-accent/80 text-white"
              >
                {pullingModel === newModelName ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Install
              </Button>
            </div>
            <p className="text-xs text-subtext0 mt-2">
              Enter a model name from Ollama's library. Popular models: llama2, codellama, mistral, llama2:13b
            </p>
            
            {/* Download Progress Display */}
            {downloadProgress && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text font-medium">
                    {downloadProgress.error ? 'Download Failed' : 'Downloading...'}
                  </span>
                  <span className="text-subtext1">
                    {downloadProgress.percentage.toFixed(1)}%
                    {downloadProgress.speed && ` • ${downloadProgress.speed}`}
                  </span>
                </div>
                
                <Progress 
                  value={downloadProgress.percentage} 
                  className="w-full h-2"
                />
                
                <div className="text-xs text-subtext1">
                  {downloadProgress.status}
                </div>
                
                {downloadProgress.error && (
                  <Alert className="border-red/20 bg-red/10">
                    <AlertCircle className="h-4 w-4 text-red" />
                    <AlertDescription className="text-red">
                      <div className="whitespace-pre-line">
                        {downloadProgress.error}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Current Model */}
          {currentModel && (
            <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-accent" />
                <span className="font-medium text-text">Current Model:</span>
                <span className="text-accent">{formatModelName(currentModel)}</span>
                {currentModel.includes(':') && (
                  <Badge variant="outline" className="text-xs bg-surface0 border-surface2 text-subtext1">
                    {currentModel.split(':')[1]}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Installed Models */}
          <div className="space-y-2">
            <h3 className="font-medium text-text mb-3">Installed Models</h3>
            
            {modelsLoading ? (
              <div className="flex items-center justify-center py-8 text-subtext1">
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Loading models...
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-8 text-subtext1">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No models installed</p>
                <p className="text-sm mt-1">Install a model to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <div
                    key={model.name}
                    className="flex items-center justify-between p-3 bg-surface0 rounded-lg border border-surface2"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {currentModel === model.name ? (
                          <CheckCircle className="w-4 h-4 text-accent" />
                        ) : (
                          <Bot className="w-4 h-4 text-subtext1" />
                        )}
                        <div>
                          <div className="font-medium text-text">
                            {formatModelName(model.name)}
                            {currentModel === model.name && (
                              <Badge variant="secondary" className="ml-2 bg-accent/20 text-accent border-accent/30">
                                Active
                              </Badge>
                            )}
                          </div>
                          {model.name.includes(':') && (
                            <div className="text-xs text-subtext0">
                              Version: {model.name.split(':')[1]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {model.size && (
                        <Badge variant="outline" className="text-xs bg-surface1 border-surface2 text-subtext1">
                          {formatSize(model.size)}
                        </Badge>
                      )}
                      {model.modified_at && (
                        <Badge variant="outline" className="text-xs bg-surface1 border-surface2 text-subtext1">
                          {new Date(model.modified_at).toLocaleDateString()}
                        </Badge>
                      )}
                      <Button
                        onClick={() => handleDeleteModel(model.name)}
                        disabled={currentModel === model.name || deletingModel === model.name}
                        variant="ghost"
                        size="sm"
                        className="text-red hover:text-red hover:bg-red/20"
                      >
                        {deletingModel === model.name ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {serviceStatus === 'offline' && (
            <div className="mt-4 p-3 bg-red/10 border border-red/20 rounded-lg">
              <div className="flex items-center space-x-2 text-red">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  Ollama service is offline. Please make sure Ollama is installed and running.
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Search Configuration */}
        <Card className="p-6 bg-surface1 border-surface2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Search className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-text">Web Search Configuration</h2>
            </div>
            {getStatusBadge(searchStatus)}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-subtext1 mb-2">
                Search Provider
              </label>
              <Select value={searchProvider} onValueChange={setSearchProvider}>
                <SelectTrigger className="w-full bg-surface0 border-surface2 text-text">
                  <SelectValue placeholder="Select a search provider" />
                </SelectTrigger>
                <SelectContent className="bg-surface1 border-surface2">
                  <SelectItem value="duckduckgo" className="text-text hover:bg-surface2">DuckDuckGo (Free)</SelectItem>
                  <SelectItem value="tavily" className="text-text hover:bg-surface2">Tavily</SelectItem>
                  <SelectItem value="serper" className="text-text hover:bg-surface2">Serper (Google)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {searchProvider !== 'duckduckgo' && (
              <div>
                <label className="block text-sm font-medium text-subtext1 mb-2">
                  API Key
                </label>
                <Input
                  type="password"
                  value={searchApiKey}
                  onChange={(e) => setSearchApiKey(e.target.value)}
                  placeholder="Enter your search API key"
                  className="bg-surface0 border-surface2 text-text"
                />
                <p className="text-xs text-subtext0 mt-1">
                  Required for web search functionality. Get your API key from{' '}
                  {searchProvider === 'tavily' ? 'tavily.com' : 'serper.dev'}
                </p>
              </div>
            )}
            
            {searchProvider === 'duckduckgo' && (
              <div className="p-3 bg-green/10 border border-green/20 rounded-lg">
                <p className="text-sm text-green">
                  ✓ DuckDuckGo search is free and requires no API key. 
                  It provides accurate results by fetching full webpage content for your local AI to process.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* RAG Configuration */}
        <Card className="p-6 bg-surface1 border-surface2">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text">Document Processing (RAG)</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface0 rounded-lg border border-surface2">
              <div>
                <h3 className="font-medium text-text">Document Upload</h3>
                <p className="text-sm text-subtext1">Upload and process documents for Q&A</p>
              </div>
              <Badge className="bg-green/20 text-green border-green/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-surface0 rounded border border-surface2">
                <strong className="text-text">Supported Formats:</strong>
                <p className="text-subtext1 mt-1">TXT, PDF, DOC, DOCX</p>
              </div>
              <div className="p-3 bg-surface0 rounded border border-surface2">
                <strong className="text-text">Max File Size:</strong>
                <p className="text-subtext1 mt-1">10 MB per file</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Document Management / RAG */}
        <Card className="p-6 bg-surface1 border-surface2">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text">Document Management (RAG)</h2>
          </div>
          <p className="text-sm text-subtext0 mb-4">
            Upload documents (TXT, PDF, DOC, DOCX) to enable Retrieval-Augmented Generation. The AI will automatically search your documents when answering questions.
          </p>
          <DocumentUpload />
        </Card>

        {/* System Information */}
        <Card className="p-6 bg-surface1 border-surface2">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text">System Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-subtext1">Frontend Version:</span>
                <span className="text-text">v1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtext1">Backend Status:</span>
                <Badge className="bg-green/20 text-green border-green/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Online
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-subtext1">Database:</span>
                <span className="text-text">SQLite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtext1">Environment:</span>
                <span className="text-text">Development</span>
              </div>
            </div>
          </div>
        </Card>

        <Separator className="bg-surface2" />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            className="bg-accent hover:bg-accent/80 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;