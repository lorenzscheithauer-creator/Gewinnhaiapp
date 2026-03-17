export const LIST_BATCHING = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  updateCellsBatchingPeriod: 40,
  windowSize: 7,
  removeClippedSubviews: true
} as const;

export function getEstimatedItemLayout(height: number) {
  return (_: unknown, index: number) => ({
    length: height,
    offset: height * index,
    index
  });
}
