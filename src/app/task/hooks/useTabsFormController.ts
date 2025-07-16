import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTabValidation } from './useTabValidation';
import { useTabDataFetch } from './useTabDataFetch';
import { TabsFormProps } from '../types/types';

export function useTabsFormController(config: TabsFormProps['config']) {
  const [activeTab, setActiveTab] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [dirtyTabs, setDirtyTabs] = useState<{ [tabKey: string]: boolean }>({});
      const initialValuesRef = useRef<{ [tabKey: string]: Record<string, any> }>({});
    const fieldRefs = useRef<{ [tabKey: string]: { [field: string]: React.RefObject<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> } }>({});
    const currentValuesRef = useRef<{ [tabKey: string]: Record<string, any> }>({});
    const [, forceUpdate] = useState(0);

  
   
  const { validateField } = useTabValidation(config);
  const [validationErrors, setValidationErrors] = useState<{ [tabKey: string]: { [fieldName: string]: string } }>({});
  const { fetchAllTabData, loading } = useTabDataFetch(config, initialValuesRef, currentValuesRef, setDirtyTabs);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAllTabData();
    }
  }, [config]);

  useEffect(() => {
    config.forEach(tab => {
      if (!fieldRefs.current[tab.key]) {
        fieldRefs.current[tab.key] = {};
        tab.fields.forEach(field => {
          fieldRefs.current[tab.key][field.name] = (window as any).React?.createRef ? (window as any).React.createRef() : null;
        });
      }
      if (!initialValuesRef.current[tab.key]) {
        const initial: Record<string, any> = {};
        tab.fields.forEach(field => {
          if (field.type === 'multiselect' || field.type === 'checkboxes') {
            initial[field.name] = [];
          } else {
            initial[field.name] = '';
          }
        });
        initialValuesRef.current[tab.key] = initial;
      }
      if (!currentValuesRef.current[tab.key]) {
        currentValuesRef.current[tab.key] = { ...initialValuesRef.current[tab.key] };
      }
      // Initialize validation errors
      if (!validationErrors[tab.key]) {
        const errors: { [fieldName: string]: string } = {};
        tab.fields.forEach(field => {
          errors[field.name] = '';
        });
        setValidationErrors(prev => ({ ...prev, [tab.key]: errors }));
      }
    });
  }, [config]);


  const handleTabClick = useCallback((idx: number) => {
    // Use startTransition for non-urgent tab switching
    startTransition(() => {
      setActiveTab(idx);
    });
  }, []);

  const checkFieldDirty = (tabKey: string, fieldName: string) => {
    const initial = initialValuesRef.current[tabKey];
    const current = currentValuesRef.current[tabKey];
    const field = config.find(tab => tab.key === tabKey)?.fields.find(f => f.name === fieldName);
  
    if (field?.type === 'multiselect' || field?.type === 'checkboxes') {
      const a = Array.isArray(initial[fieldName]) ? initial[fieldName] : [];
      const b = Array.isArray(current[fieldName]) ? current[fieldName] : [];
      if (a.length !== b.length) return true;
      // Compare contents (order-insensitive)
      return a.sort().join(',') !== b.sort().join(',');
    }
    return current[fieldName] !== initial[fieldName];
  };

  const checkFieldDirtyName = (tabKey: string, fieldName: string) => {
    const initial = initialValuesRef.current[tabKey];
    const current = currentValuesRef.current[tabKey];
    const field = config.find(tab => tab.key === tabKey)?.fields.find(f => f.name === fieldName);
  
    if (field?.type === 'multiselect' || field?.type === 'checkboxes') {
      const a = Array.isArray(initial[fieldName]) ? initial[fieldName] : [];
      const b = Array.isArray(current[fieldName]) ? current[fieldName] : [];
      if (a.length !== b.length) return fieldName
      // Compare contents (order-insensitive)
      return a.sort().join(',') !== b.sort().join(',') ? fieldName : '';
    }
    return current[fieldName] !== initial[fieldName] ? fieldName : '';
  };

  const handleInputBlur = useCallback((tabKey: string, fieldName: string) => {
    const value = currentValuesRef.current[tabKey]?.[fieldName] ?? '';
    const error = validateField(tabKey, fieldName, value);
    setValidationErrors(prev => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        [fieldName]: error
      }
    }));
    const dynamicKey = `${tabKey}_keys`;
    setDirtyTabs(prev => ({
      ...prev,
      [tabKey]: checkFieldDirty(tabKey, fieldName) || Object.keys(currentValuesRef.current[tabKey]).some(key => key !== fieldName && checkFieldDirty(tabKey, key)),
      [dynamicKey]: {
        ...prev[dynamicKey],
        [fieldName]: checkFieldDirtyName(tabKey, fieldName)
      }
    }));
  }, [checkFieldDirty, currentValuesRef, setDirtyTabs, validateField]);

  const handleInputChange = (tabKey: string, fieldName: string, value: any,isForceUpdate:boolean = false) => {
    currentValuesRef.current[tabKey] = {
      ...currentValuesRef.current[tabKey],
      [fieldName]: value,
    };
    const error = validateField(tabKey, fieldName, value);
    if (error === '' && validationErrors[tabKey]?.[fieldName]) {
      setValidationErrors(prev => ({
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          [fieldName]: ''
        }
      }));
    }
    if(isForceUpdate){
      forceUpdate(n => n + 1); // Force re-render for UI sync
    }
  };

  const handleSave = async (tabIdx: number) => {
    const tab = config[tabIdx];
    const data = { ...currentValuesRef.current[tab.key] };
    let hasError = false;
    const newErrors: { [fieldName: string]: string } = {};
    for (const field of tab.fields) {
      const value = data[field.name];
      const error = validateField(tab.key, field.name, value);
      newErrors[field.name] = error;
      if (error) {
        hasError = true;
      }
    }
    setValidationErrors(prev => ({
      ...prev,
      [tab.key]: newErrors
    }));
    if (hasError) {
      alert('Please fix the validation errors before saving.');
      return;
    }
    // Call API
    try {
      await fetch(tab.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      // Update initial values and current values
      initialValuesRef.current[tab.key] = { ...data };
      currentValuesRef.current[tab.key] = { ...data };
      setDirtyTabs(prev => ({ ...prev, [tab.key]: false }));
      // Move to next tab if not last
      if (tabIdx < config.length - 1) {
        setActiveTab(tabIdx + 1);
      }
    } catch (e) {
      alert('Failed to save.');
    }
  };

  return {
    activeTab,
    setActiveTab,
    dirtyTabs,
    setDirtyTabs,
    handleTabClick,
    initialValuesRef,
    currentValuesRef,
    fieldRefs,
    checkFieldDirty,
    validationErrors,
    setValidationErrors,
    fetchAllTabData,
    loading,
    handleInputBlur,
    handleInputChange,
    handleSave,
    config,
  };
} 