import React, { memo } from "react";
import { TabFieldProps } from "../types/types";

const TabField: React.FC<TabFieldProps> = ({
  field,
  value,
  error,
  inputRef,
  onChange,
  onBlur,
}) => {
    console.log("Rendered TabField",field.name,value)
  return (
    <div style={{ marginBottom: 12 }}>
      <label>
        {field.label}
        {field.required && " *"}
        <br />
        {field.type === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            name={field.name}
            value={value}
            onChange={(e) => onChange(e.target.value, true)}
            onBlur={onBlur}
            style={{
              padding: 6,
              width: 200,
              border: error ? "1px solid red" : "1px solid #ccc",
            }}
          >
            <option value="">Select...</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "multiselect" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            name={field.name}
            value={value || []}
            multiple
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
              onChange(selected, true);
            }}
            onBlur={onBlur}
            style={{
              padding: 6,
              width: 200,
              height: 80,
              border: error ? "1px solid red" : "1px solid #ccc",
            }}
          >
            {field.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "checkboxes" ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {field.options?.map((option: string) => (
              <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  name={field.name}
                  checked={Array.isArray(value) ? value.includes(option) : false}
                  onChange={(e) => {
                    let newValue = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      newValue.push(option);
                    } else {
                      newValue = newValue.filter((v) => v !== option);
                    }
                    onChange(newValue, true);
                  }}
                  onBlur={onBlur}
                />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <input
            onBlur={onBlur}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            name={field.name}
            type={field.type}
            defaultValue={value}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(e.target.value, false)}
            style={{
              padding: 6,
              width: 200,
              border: error ? "1px solid red" : "1px solid #ccc",
            }}
          />
        )}
      </label>
      {error && (
        <p style={{ color: "red", margin: "4px 0 0 0", fontSize: "12px" }}>
          {error}
        </p>
      )}
    </div>
  );
};

function areEqual(prevProps: TabFieldProps, nextProps: TabFieldProps) {
  return (
    prevProps.value === nextProps.value &&
    prevProps.error === nextProps.error &&
    prevProps.field.name === nextProps.field.name
  );
}

export default memo(TabField, areEqual);
