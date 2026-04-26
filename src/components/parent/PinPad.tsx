// src/components/parent/PinPad.tsx
import React, { useState, useEffect } from 'react';

export function PinPad({ onComplete }: { onComplete: (pin: string) => void }) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (pin.length === 4) {
      onComplete(pin);
      setPin(''); // Reset after submission attempts
    }
  }, [pin, onComplete]);

  const handlePress = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  return (
    <div className="flex flex-col items-center bg-gray-900 p-6 rounded-2xl max-w-xs mx-auto">
      <h3 className="text-slate-800 font-medium mb-4">Enter Parental PIN</h3>
      <div className="flex gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < pin.length ? 'bg-white border-white' : 'border-gray-500'}`}></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => handlePress(d)} className="w-16 h-16 rounded-full bg-gray-800 text-white text-xl font-medium focus:bg-gray-700 hover:bg-gray-700">
            {d}
          </button>
        ))}
        <div></div>
        <button onClick={() => handlePress('0')} className="w-16 h-16 rounded-full bg-gray-800 text-white text-xl font-medium focus:bg-gray-700 hover:bg-gray-700">
          0
        </button>
        <button onClick={() => setPin(prev => prev.slice(0, -1))} className="w-16 h-16 rounded-full bg-transparent text-gray-400 text-lg font-medium">
          DEL
        </button>
      </div>
    </div>
  );
}
