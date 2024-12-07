export function deepFlatten(arr) {
  return arr.reduce((acc, val) => {
    if (Array.isArray(val)) {
      acc.push(...deepFlatten(val))
    } else {
      acc.push(val)
    }
    return acc
  }, [])
}
