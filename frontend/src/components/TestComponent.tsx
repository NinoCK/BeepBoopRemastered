import React from 'react';
import { Button } from './ui/button';

const TestComponent: React.FC = () => {
  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      const response = await fetch('http://localhost:8000/api/test');
      const data = await response.json();
      console.log('Backend test response:', data);
      alert('Backend connection successful!');
    } catch (error) {
      console.error('Backend connection failed:', error);
      alert('Backend connection failed!');
    }
  };

  const testCreateChat = async () => {
    try {
      console.log('Testing chat creation...');
      const response = await fetch('http://localhost:8000/api/chat/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ title: 'Test Chat' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Chat creation response:', data);
      alert(`Chat created successfully! ID: ${data.id}`);
    } catch (error) {
      console.error('Chat creation failed:', error);
      alert(`Chat creation failed: ${error}`);
    }
  };

  const testThinkingStream = async () => {
    try {
      console.log('Testing thinking stream...');
      
      const response = await fetch('http://127.0.0.1:8000/api/test/thinking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      console.log('Starting to read stream...');
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('Received:', data);
            } catch (parseError) {
              console.error('Failed to parse:', line);
            }
          }
        }
      }

      alert('Thinking stream test completed! Check console for details.');
    } catch (error) {
      console.error('Thinking stream test failed:', error);
      alert(`Thinking stream test failed: ${error}`);
    }
  };

  const testThinkingExtraction = async () => {
    try {
      console.log('Testing thinking extraction...');
      const response = await fetch('http://127.0.0.1:8000/api/test/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      
      const data = await response.json();
      console.log('Extraction test result:', data);
      alert(`Thinking extraction test: ${data.thinking_found ? 'SUCCESS' : 'FAILED'}\nCheck console for details.`);
    } catch (error) {
      console.error('Extraction test failed:', error);
      alert(`Extraction test failed: ${error}`);
    }
  };

  return (
    <div className="p-4 border border-surface2 rounded-lg bg-surface1">
      <h3 className="text-lg font-bold mb-4 text-text">Backend Connection Test</h3>
      <div className="space-x-2 space-y-2">
        <div className="flex space-x-2">
          <Button onClick={testBackendConnection} variant="outline" size="sm">
            Test Backend
          </Button>
          <Button onClick={testCreateChat} variant="outline" size="sm">
            Test Create Chat
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button onClick={testThinkingStream} variant="outline" size="sm" className="bg-accent/10 border-accent/30 text-accent hover:bg-accent/20">
            Test Thinking Stream
          </Button>
          <Button onClick={testThinkingExtraction} variant="outline" size="sm" className="bg-blue/10 border-blue/30 text-blue hover:bg-blue/20">
            Test Extraction
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TestComponent;