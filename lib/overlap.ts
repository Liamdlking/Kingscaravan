
export function overlaps(a: any, b: any) {
  const aStart = new Date(a.start_date).getTime();
  const aEnd = new Date(a.end_date).getTime();
  const bStart = new Date(b.start_date).getTime();
  const bEnd = new Date(b.end_date).getTime();
  return aStart < bEnd && bStart < aEnd;
}
