export default function deepMerge(target: any, source: any) {
  for (const key in source) {
    if (source[key] && typeof source[key] === "object") {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = Array.isArray(source[key]) ? [] : {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
