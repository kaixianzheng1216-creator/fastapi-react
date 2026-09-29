export async function mapConcurrent<T, R>(
  items: T[],
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const iterator = items.entries();
  const results: R[] = [];

  async function worker() {
    for (const [index, item] of iterator) {
      results[index] = await run(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(3, items.length) }, () => worker()),
  );

  return results;
}
