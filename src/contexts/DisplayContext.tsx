import { createContext, useContext } from 'react';

export interface DisplayContextValue {
  isWallMode: boolean;
  isSleepMode: boolean;
  isKioskMode: boolean;
}

export const DisplayContext = createContext<DisplayContextValue>({
  isWallMode: false,
  isSleepMode: false,
  isKioskMode: false,
});

export const useDisplayMode = () => useContext(DisplayContext);
