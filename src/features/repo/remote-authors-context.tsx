import { createContext, useContext } from "react";

export type RemoteAuthorsContextValue = {
  map: Map<string, string>;
  isSettled: boolean;
};

export const RemoteAuthorsContext = createContext<RemoteAuthorsContextValue>({
  map: new Map(),
  isSettled: true,
});

export function useRemoteAuthorsContext() {
  return useContext(RemoteAuthorsContext);
}
