export const ROLE_FAMILIES = [
  {
    key: "program_management",
    label: "Program Management",
    keywords: [
      "program manager",
      "technical program manager",
      "tpm",
      "delivery manager",
      "implementation manager",
      "project manager",
      "project coordinator",
    ],
  },
  {
    key: "product_management",
    label: "Product Management",
    keywords: [
      "product manager",
      "product owner",
      "product strategist",
    ],
  },
  {
    key: "software_engineering",
    label: "Software Engineering",
    keywords: [
      "software engineer",
      "software developer",
      "backend engineer",
      "frontend engineer",
      "full stack engineer",
      "fullstack engineer",
    ],
  },
  {
    key: "data_ai",
    label: "Data / AI",
    keywords: [
      "data scientist",
      "machine learning",
      "ai engineer",
      "ml engineer",
      "data analyst",
      "data engineer",
    ],
  },
  {
    key: "design",
    label: "Design",
    keywords: [
      "product designer",
      "ux designer",
      "ui designer",
      "ux/ui",
    ],
  },
  {
    key: "operations_strategy",
    label: "Operations / Strategy",
    keywords: [
      "operations manager",
      "business operations",
      "strategy manager",
      "operations analyst",
    ],
  },
] as const;

export type RoleFamilyKey = (typeof ROLE_FAMILIES)[number]["key"] | "other";

export function classifyRole(title: string): RoleFamilyKey {
  const lower = title.toLowerCase();
  for (const family of ROLE_FAMILIES) {
    for (const keyword of family.keywords) {
      if (lower.includes(keyword)) {
        return family.key;
      }
    }
  }
  return "other";
}

export function getRoleFamilyLabel(key: RoleFamilyKey): string {
  if (key === "other") return "Other";
  const family = ROLE_FAMILIES.find((f) => f.key === key);
  return family?.label ?? "Other";
}
