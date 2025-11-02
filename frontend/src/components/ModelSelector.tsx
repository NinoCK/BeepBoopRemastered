import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ChevronDown, Bot, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { useAppLogging } from '../contexts/AppLoggingContext';

interface Model {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: any;
}

interface ModelSelectorProps {
  className?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ className = '' }) => {
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [serviceStatus, setServiceStatus] = useState<'running' | 'offline' | 'unknown'>('unknown');
  const { addLog } = useAppLogging();

  const fetchModels = async () => {
    try {
      const response = await api.get('/models');
      if (response.data.success) {
        setModels(response.data.models);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModels([]);
    }
  };

  const fetchCurrentModel = async () => {
    try {
      const response = await api.get('/models/current');
      if (response.data.success) {
        setCurrentModel(response.data.model);
      }
    } catch (error) {
      console.error('Failed to fetch current model:', error);
    }
  };

  const fetchServiceStatus = async () => {
    try {
      const response = await api.get('/models/status');
      if (response.data.success) {
        setServiceStatus(response.data.status);
      }
    } catch (error) {
      setServiceStatus('offline');
    }
  };

  const handleModelChange = async (modelName: string) => {
    const previousModel = currentModel;
    
    addLog({
      level: 'info',
      category: 'model',
      message: `Changing model from ${previousModel || 'none'} to ${modelName}`,
      source: 'ModelSelector',
      context: { previousModel, newModel: modelName }
    });
    
    try {
      const response = await api.post('/models/current', { model: modelName });
      if (response.data.success) {
        setCurrentModel(modelName);
        addLog({
          level: 'success',
          category: 'model',
          message: `Model changed successfully to: ${modelName}`,
          source: 'ModelSelector',
          context: { previousModel, newModel: modelName }
        });
        console.log(`Model changed to: ${modelName}`);
      }
    } catch (error) {
      console.error('Failed to change model:', error);
      addLog({
        level: 'error',
        category: 'model',
        message: `Failed to change model to: ${modelName}`,
        source: 'ModelSelector',
        context: { 
          previousModel, 
          newModel: modelName, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchModels(),
        fetchCurrentModel(),
        fetchServiceStatus()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Periodically check service status
  useEffect(() => {
    const interval = setInterval(() => {
      fetchServiceStatus();
    }, 5000); // Check every 5 seconds

    // Check immediately on mount
    fetchServiceStatus();

    return () => clearInterval(interval);
  }, []);

  const formatModelName = (name: string) => {
    // Remove version tags for display (e.g., "llama2:7b" -> "llama2")
    return name.split(':')[0];
  };

  const formatSize = (size: number) => {
    if (!size) return '';
    const gb = size / (1024 * 1024 * 1024);
    return gb > 1 ? `${gb.toFixed(1)}GB` : `${(size / (1024 * 1024)).toFixed(0)}MB`;
  };

  const getStatusIcon = () => {
    switch (serviceStatus) {
      case 'running':
        return <CheckCircle className="w-3 h-3 text-green" />;
      case 'offline':
        return <AlertCircle className="w-3 h-3 text-red" />;
      default:
        return <Circle className="w-3 h-3 text-subtext1" />;
    }
  };

  const getStatusColor = () => {
    switch (serviceStatus) {
      case 'running':
        return 'bg-green/20 text-green border-green/30';
      case 'offline':
        return 'bg-red/20 text-red border-red/30';
      default:
        return 'bg-surface2 text-subtext1';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Bot className="w-4 h-4 text-subtext1 animate-pulse" />
        <span className="text-sm text-subtext1">Loading...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      {/* Model Display Button */}
      <Button
        variant="outline"
        size="sm"
        className="flex items-center space-x-2 text-text border-surface2 bg-surface1 hover:bg-surface2 rounded-r-none border-r-0"
        disabled
      >
        <Bot className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">
          {formatModelName(currentModel) || 'No Model'}
        </span>
        <Badge variant="secondary" className={`hidden md:inline-flex items-center gap-1 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span>{serviceStatus}</span>
        </Badge>
      </Button>
      
      {/* Dropdown Trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="px-2 text-text border-surface2 bg-surface1 hover:bg-surface2 rounded-l-none border-l-surface2"
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64 bg-surface1 border-surface2">
        <DropdownMenuLabel className="text-text">
          <div className="flex items-center justify-between">
            <span>Select Model</span>
            <Badge variant="secondary" className={`inline-flex items-center gap-1 ${getStatusColor()}`}>
              {getStatusIcon()}
              <span>{serviceStatus}</span>
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-surface2" />
        
        {models.length === 0 ? (
          <DropdownMenuItem disabled className="text-subtext1">
            <AlertCircle className="w-4 h-4 mr-2" />
            No models available
          </DropdownMenuItem>
        ) : (
          models.map((model) => (
            <DropdownMenuItem
              key={model.name}
              onClick={() => handleModelChange(model.name)}
              className="flex items-center justify-between cursor-pointer hover:bg-surface2 text-text"
            >
              <div className="flex items-center space-x-2">
                {currentModel === model.name ? (
                  <CheckCircle className="w-4 h-4 text-accent" />
                ) : (
                  <Circle className="w-4 h-4 text-subtext1" />
                )}
                <div>
                  <div className="font-medium">{formatModelName(model.name)}</div>
                  {model.name.includes(':') && (
                    <div className="text-xs text-subtext0">
                      {model.name.split(':')[1]}
                    </div>
                  )}
                </div>
              </div>
              {model.size && (
                <Badge variant="outline" className="text-xs bg-surface0 border-surface2 text-subtext1">
                  {formatSize(model.size)}
                </Badge>
              )}
            </DropdownMenuItem>
          ))
        )}
        
        {serviceStatus === 'offline' && (
          <>
            <DropdownMenuSeparator className="bg-surface2" />
            <DropdownMenuItem disabled className="text-red text-xs">
              <AlertCircle className="w-3 h-3 mr-2" />
              Ollama service is offline
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
};

export default ModelSelector;