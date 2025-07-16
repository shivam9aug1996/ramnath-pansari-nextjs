"use client";
import React, { memo, useCallback, useMemo } from "react";
import TabHeader from "./TabHeader";
import TabField from "./TabField";
import { TabsFormProps } from "../types/types";
import { useTabsFormController } from "../hooks/useTabsFormController";

const TabsForm: React.FC<TabsFormProps> = ({ config }) => {
  const {
    activeTab,
    dirtyTabs,
    handleTabClick,
    fieldRefs,
    currentValuesRef,
    validationErrors,
    loading,
    handleInputBlur,
    handleInputChange,
    handleSave,
  } = useTabsFormController(config);

  const handleFieldChange = useCallback(
    (tabKey: string, fieldName: string) => (value: any, isForceUpdate?: boolean) => {
      handleInputChange(tabKey, fieldName, value, isForceUpdate);
    },
    [handleInputChange]
  );
  
  const handleFieldBlur = useCallback(
    (tabKey: string, fieldName: string) => () => {
      handleInputBlur(tabKey, fieldName);
    },
    [handleInputBlur]
  );


  return (
    <div>
       {loading && (
        <div
          style={{
            textAlign: "center",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1000,
          }}
        >
          Loading...
        </div>
      )}
      <TabHeader
        tabs={config.map((tab) => ({ key: tab.key, label: tab.label }))}
        activeTab={activeTab}
        dirtyTabs={dirtyTabs}
        onTabClick={handleTabClick}
      />
     
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(activeTab);
        }}
        autoComplete="off"
      >
        {config[activeTab].fields.map((field) => {
          const ref = fieldRefs?.current?.[config[activeTab].key]?.[field.name];
          const tabKey = config[activeTab].key;
          const currentValue =
            currentValuesRef?.current?.[tabKey]?.[field.name] ?? "";
          const fieldError = validationErrors[tabKey]?.[field.name] ?? "";
          return (
            <TabField
              key={field.name}
              field={field}
              value={currentValue}
              error={fieldError}
              inputRef={ref}
              onChange={handleFieldChange(tabKey, field.name)}
              onBlur={handleFieldBlur(tabKey, field.name)}
            />
          );
        })}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit">Save & Next</button>
        </div>
      </form>
    </div>
  );
};

export default memo(TabsForm);
