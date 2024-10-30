import React, { createContext, useContext, useEffect, useState } from 'react';

type WindowDimensionsContextType = {
  width: number | null;
  height: number | null;
};

const WindowDimensionsContext = createContext<WindowDimensionsContextType>({
  width: null,
  height: null,
});

export function WindowDimensionsProvider({
  children,
  width,
  height,
}: {
  children: React.ReactNode;
  width: number | null;
  height: number | null;
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
