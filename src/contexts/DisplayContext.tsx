import { createContext, useContext } from 'react';

export interface DisplayContextValue {
  isWallMode: boolean;
  isSleepMode: boolean;
}

export const DisplayContext = createContext<DisplayContextValue>({
  isWallMode: false,
  isSleepMode: false,
});

export const useDisplayMode = () => useContext(DisplayContext);
