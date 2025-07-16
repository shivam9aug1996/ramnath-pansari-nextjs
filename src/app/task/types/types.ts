// Types for config
export type FieldConfig = {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    min?: number;
    max?: number;
    validation?: (value: any) => string | null;
    options?: string[];
  };
  
  export type TabConfig = {
    key: string;
    label: string;
    api: string;
    fields: FieldConfig[];
  };
  
  export type TabsFormProps = {
    config: TabConfig[];
  };

  export type TabFieldProps = {
    field: any;
    value: any;
    error: string;
    inputRef: React.RefObject<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >;
    onChange: (value: any, isForceUpdate?: boolean) => void;
    onBlur: () => void;
  };

  export type TabHeaderProps = {
    tabs: { key: string; label: string }[];
    activeTab: number;
    dirtyTabs: { [tabKey: string]: boolean };
    onTabClick: (idx: number) => void;
  };