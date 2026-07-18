import { useCallback, useEffect, useState } from "react";
import { diagramApi } from "../../../../../api/diagrams";

function readError(error) {
  return error?.message || "Failed to load diagrams";
}

export function useDiagramList() {
  const [state, setState] = useState({ loading: true, error: null, items: [] });

  const refresh = useCallback(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    diagramApi
      .list()
      .then((items) => {
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            items: items.map((item) => ({
              ...item,
              diagramId: item.id,
              lastModified: item.updated_at,
            })),
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ loading: false, error: readError(error), items: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(refresh, [refresh]);

  return {
    loading: state.loading,
    error: state.error,
    cloud: [],
    local: state.items,
    cloudEnabled: false,
    currentUserId: null,
    refresh,
  };
}
