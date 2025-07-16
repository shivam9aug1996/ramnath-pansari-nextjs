import React, { memo } from "react";
import { TabHeaderProps } from "../types/types";

const TabHeader: React.FC<TabHeaderProps> = ({
  tabs,
  activeTab,
  dirtyTabs,
  onTabClick,
}) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
    {tabs.map((tab, idx) => (
      <button
        key={tab.key}
        style={{
          padding: "8px 16px",
          borderBottom:
            activeTab === idx ? "2px solid blue" : "2px solid transparent",
          background: "none",
          cursor: "pointer",
          fontWeight: activeTab === idx ? "bold" : "normal",
          color: dirtyTabs[tab.key] ? "red" : "black",
        }}
        onClick={() => onTabClick(idx)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default memo(TabHeader);
