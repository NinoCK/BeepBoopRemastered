import React, { createContext, useContext, useState, useCallback } from 'react';

interface ModelOperation {
  id: string;
  type: 'download' | 'delete' | 'select';
  model: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  message?: string;
  startTime: Date;
  endTime?: Date;
}

interface ModelOperationContextType {
  operations: ModelOperation[];
  addOperation: (operation: Omit<ModelOperation, 'id' | 'startTime'>) => string;
  updateOperation: (id: string, updates: Partial<ModelOperation>) => void;
  removeOperation: (id: string) => void;
  clearOperations: () => void;
}

const ModelOperationContext = createContext<ModelOperationContextType | undefined>(undefined);

export const ModelOperationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<ModelOperation[]>([]);

  const addOperation = useCallback((operation: Omit<ModelOperation, 'id' | 'startTime'>) => {
    const newOperation: ModelOperation = {
      ...operation,
      id: `${operation.type}_${operation.model}_${Date.now()}`,
      startTime: new Date(),
    };
    
    setOperations(prev => [...prev, newOperation]);
    return newOperation.id;
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<ModelOperation>) => {
    setOperations(prev => 
      prev.map(op => 
        op.id === id 
          ? { ...op, ...updates, ...(updates.status === 'completed' || updates.status === 'error' ? { endTime: new Date() } : {}) }
          : op
      )
    );
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const clearOperations = useCallback(() => {
    setOperations([]);
  }, []);

  return (
    <ModelOperationContext.Provider value={{
      operations,
      addOperation,
      updateOperation,
      removeOperation,
      clearOperations
    }}>
      {children}
    </ModelOperationContext.Provider>
  );
};

export const useModelOperations = () => {
  const context = useContext(ModelOperationContext);
  if (context === undefined) {
    throw new Error('useModelOperations must be used within a ModelOperationProvider');
  }
  return context;
};

export type { ModelOperation };