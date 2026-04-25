// src/components/parent/ConnectedAccountsView.tsx
import React from 'react';

interface Connection {
  id: string;
  provider: string;
  email: string; // We'll assume the sync model returns the email for display
}

interface Props {
  connections: Connection[];
  onConnect: (provider: string) => void;
  onDisconnect: (connectionId: string) => void;
}

export function ConnectedAccountsView({ connections, onConnect, onDisconnect }: Props) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Connected Accounts</h2>
      
      <div className="space-y-4">
        {connections.map(conn => (
          <div key={conn.id} className="flex justify-between items-center p-3 border rounded">
            <div>
              <span className="font-medium capitalize">{conn.provider}</span>
              <p className="text-sm text-gray-500">{conn.email}</p>
            </div>
            <button 
              onClick={() => onDisconnect(conn.id)}
              className="text-red-600 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded"
            >
              Disconnect
            </button>
          </div>
        ))}

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-2">Connect New Account</h3>
          <button 
            onClick={() => onConnect('google')}
            className="flex items-center gap-2 px-4 py-2 bg-white border shadow-sm rounded-md font-medium text-gray-700 hover:bg-gray-50"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Connect Google Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
