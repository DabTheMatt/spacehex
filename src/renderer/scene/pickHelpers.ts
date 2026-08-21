export interface PickNode {
  userData: Record<string, unknown>
  parent: PickNode | null
}

export function userDataAlongAncestors<T>(object: PickNode | null, key: string): T | undefined {
  let obj: PickNode | null = object
  while (obj) {
    if (obj.userData[key] !== undefined) return obj.userData[key] as T
    obj = obj.parent
  }
  return undefined
}

/** First matching userData walking every raycast hit, then its parents. */
export function userDataFromHits<T>(hits: Array<{ object: PickNode }>, key: string): T | undefined {
  for (const hit of hits) {
    const value = userDataAlongAncestors<T>(hit.object, key)
    if (value !== undefined) return value
  }
  return undefined
}
