import { TabConfig } from "./types/types";

const tabConfig: TabConfig[] = [
  {
    key: "personal",
    label: "Personal Info",
    api: "/api/personal",
    fields: [
      { name: "firstName", label: "First Name", type: "text", required: true },
      { name: "age", label: "Age", type: "number", required: false, min: 0 },
    ],
  },
  {
    key: "address",
    label: "Address",
    api: "/api/address",
    fields: [
      { name: "city", label: "City", type: "text", required: true },
      { name: "zip", label: "ZIP Code", type: "number", required: true },
      {
        name: "country",
        label: "Country",
        type: "select",
        required: true,
        options: ["USA", "Canada", "UK", "Australia", "India"],
      },
    ],
  },
];

export default tabConfig;
