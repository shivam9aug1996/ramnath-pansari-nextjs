import { ObjectId } from "mongodb";
import { asMongoUpdate } from "@/types/api";

export type CategoryNode = {
  _id: ObjectId;
  name: string;
  image?: string | null;
  children?: CategoryNode[];
};

export type NormalizedCategory = {
  _id: string;
  name: string;
  image: string | null;
  children: NormalizedCategory[];
};

export function countCategoryStats(categories: CategoryNode[]): {
  total: number;
  root: number;
  leaf: number;
} {
  let total = 0;
  let leaf = 0;

  const walk = (nodes: CategoryNode[]) => {
    for (const category of nodes) {
      total++;
      const children = category.children ?? [];
      if (children.length === 0) {
        leaf++;
      } else {
        walk(children);
      }
    }
  };

  walk(categories);
  return { total, root: categories.length, leaf };
}

export function normalizeCategoryTree(
  categories: CategoryNode[],
): NormalizedCategory[] {
  return categories.map((cat) => ({
    _id: cat._id.toString(),
    name: cat.name,
    image: cat.image ?? null,
    children: normalizeCategoryTree(cat.children ?? []),
  }));
}

export function findCategoryById(
  categories: CategoryNode[],
  id: string,
): CategoryNode | null {
  for (const category of categories) {
    if (category._id.toString() === id) {
      return category;
    }
    const found = findCategoryById(category.children ?? [], id);
    if (found) return found;
  }
  return null;
}

export function findCategoryPath(
  categories: CategoryNode[],
  id: string,
  trail: CategoryNode[] = [],
): CategoryNode[] | null {
  for (const category of categories) {
    const nextTrail = [...trail, category];
    if (category._id.toString() === id) {
      return nextTrail;
    }
    const found = findCategoryPath(category.children ?? [], id, nextTrail);
    if (found) return found;
  }
  return null;
}

export function updateCategoryInTree(
  categories: CategoryNode[],
  id: string,
  patch: { name?: string; image?: string | null },
): CategoryNode[] {
  return categories.map((category) => {
    if (category._id.toString() === id) {
      return {
        ...category,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.image !== undefined ? { image: patch.image } : {}),
        children: category.children ?? [],
      };
    }
    return {
      ...category,
      children: updateCategoryInTree(category.children ?? [], id, patch),
    };
  });
}

export function removeCategoryFromTree(
  categories: CategoryNode[],
  id: string,
): CategoryNode[] {
  return categories
    .filter((category) => category._id.toString() !== id)
    .map((category) => ({
      ...category,
      children: removeCategoryFromTree(category.children ?? [], id),
    }));
}

export function countCategoryChildren(category: CategoryNode): number {
  return (category.children ?? []).length;
}

export async function findRootDocForCategoryId(
  db: { collection: (name: string) => { find: Function; findOne: Function } },
  id: string,
) {
  const roots = (await db.collection("categories").find({}).toArray()) as CategoryNode[];

  for (const root of roots) {
    if (root._id.toString() === id) {
      return { rootDoc: root, isRoot: true };
    }
    if (findCategoryById(root.children ?? [], id)) {
      return { rootDoc: root, isRoot: false };
    }
  }

  return null;
}

export function buildNewCategory(name: string, image?: string | null): CategoryNode {
  return {
    _id: new ObjectId(),
    name,
    image: image ?? null,
    children: [],
  };
}

export async function addCategoryToParent(
  db: { collection: (name: string) => { updateOne: Function } },
  parentCategoryId: string,
  category: CategoryNode,
) {
  const nestedResult = await db.collection("categories").updateOne(
    { "children._id": new ObjectId(parentCategoryId) },
    asMongoUpdate({ $push: { "children.$.children": category } }),
  );

  if (nestedResult.matchedCount === 0) {
    return db.collection("categories").updateOne(
      { _id: new ObjectId(parentCategoryId) },
      asMongoUpdate({ $push: { children: category } }),
    );
  }

  return nestedResult;
}

export function normalizeSingleCategory(
  category: CategoryNode,
): NormalizedCategory {
  return {
    _id: category._id.toString(),
    name: category.name,
    image: category.image ?? null,
    children: normalizeCategoryTree(category.children ?? []),
  };
}

export type FlatCategoryRow = {
  _id: string;
  name: string;
  image: string | null;
  depth: number;
  parentId: string | null;
  childCount: number;
};

export function flattenCategoryTree(
  categories: NormalizedCategory[],
  depth = 0,
  parentId: string | null = null,
): FlatCategoryRow[] {
  const rows: FlatCategoryRow[] = [];
  for (const cat of categories) {
    rows.push({
      _id: cat._id,
      name: cat.name,
      image: cat.image,
      depth,
      parentId,
      childCount: cat.children.length,
    });
    if (cat.children.length > 0) {
      rows.push(...flattenCategoryTree(cat.children, depth + 1, cat._id));
    }
  }
  return rows;
}
