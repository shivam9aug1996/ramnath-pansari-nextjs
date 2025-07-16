import { useState } from 'react';
import { TabConfig } from '../types/types';

export function useTabDataFetch(config: TabConfig[], initialValuesRef: any, currentValuesRef: any, setDirtyTabs: (updater: any) => void) {
  const [loading, setLoading] = useState(true);

  const fetchAllTabData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/task/data');
      if (response.ok) {
        const allData = await response.json();
        config.forEach(tab => {
          const tabData = allData[tab.key] || {};
          initialValuesRef.current[tab.key] = { ...tabData };
          currentValuesRef.current[tab.key] = { ...tabData };
          setDirtyTabs((prev: any) => ({ ...prev, [tab.key]: false }));
        });
      }
    } catch (error) {
      console.error('Failed to fetch tab data:', error);
    } finally {
      setLoading(false);
    }
  };

  return { fetchAllTabData, loading, setLoading };
} 