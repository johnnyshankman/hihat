import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';

/**
 * Read the production log file path. Returns `{ path: null, exists: false }`
 * outside of production. Cached for the session — the path doesn't change.
 */
export function useLogFilePath() {
  return useQuery<{ path: string | null; exists: boolean }>({
    queryKey: queryKeys.logFilePath,
    queryFn: () => window.electron.app.getLogFilePath(),
    staleTime: Infinity,
  });
}
