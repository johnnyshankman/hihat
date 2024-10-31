import React, { createContext, useContext, useEffect, useState } from 'react';

type WindowDimensionsContextType = {
  width: number;
  height: number;
};

const WindowDimensionsContext = createContext<WindowDimensionsContextType>({
  /**
   * @note these default dimensions come from the window main.ts
   */
  width: 1024,
  height: 1024,
});

export function WindowDimensionsProvider({
  children,
  width,
  height,
}: {
  children: React.ReactNode;
  width: number;
  height: number;
}) {
  const [dimensions, setDimensions] = useState<WindowDimensionsContextType>({
    width,
    height,
  });

  useEffect(() => {
    setDimensions({ width, height });
  }, [width, height]);

  return (
    <WindowDimensionsContext.Provider value={dimensions}>
      {children}
    </WindowDimensionsContext.Provider>
  );
}

export const useWindowDimensions = () => {
  const context = useContext(WindowDimensionsContext);
  if (context === undefined) {
    throw new Error(
      'useWindowDimensions must be used within a WindowDimensionsProvider',
    );
  }
  return context;
};
