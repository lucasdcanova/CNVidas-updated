import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { User } from '../../../shared/types';

export const useUser = () => {
  return useQuery<User, Error>({
    queryKey: ['/api/auth/me'],
    queryFn: async ({ signal }) => {
      const response = await apiRequest('GET', '/api/auth/me');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      // A rota retorna { user: ... }, então pegamos o user
      return data.user || data;
    },
  });
}