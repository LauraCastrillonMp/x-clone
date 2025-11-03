import { useState } from 'react';
export default function usePagination(initialPage=1, limit=10) {
  const [page, setPage] = useState(initialPage);
  const nextPage = () => setPage(p => p+1);
  const resetPage = () => setPage(initialPage);
  return { page, nextPage, resetPage, limit };
}
