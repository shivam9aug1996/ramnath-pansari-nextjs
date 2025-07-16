import { TabConfig } from '../types/types';

export function useTabValidation(config: TabConfig[]) {
  const validateField = (tabKey: string, fieldName: string, value: any) => {
    const tab = config.find(t => t.key === tabKey);
    const field = tab?.fields.find(f => f.name === fieldName);
    if (!field) return '';
    if (field.required && !value) {
      return `${field.label} is required`;
    }
    if (field.type === 'number' && value !== '') {
      const numValue = Number(value);
      if (field.min !== undefined && numValue < field.min) {
        return `${field.label} must be at least ${field.min}`;
      }
      if (field.max !== undefined && numValue > field.max) {
        return `${field.label} must be at most ${field.max}`;
      }
    }
    if (field.validation) {
      const customError = field.validation(value);
      if (customError) {
        return customError;
      }
    }
    return '';
  };

  const validateTab = (tabKey: string, values: Record<string, any>) => {
    const tab = config.find(t => t.key === tabKey);
    if (!tab) return {};
    const errors: { [fieldName: string]: string } = {};
    tab.fields.forEach(field => {
      errors[field.name] = validateField(tabKey, field.name, values[field.name]);
    });
    return errors;
  };

  return { validateField, validateTab };
} 