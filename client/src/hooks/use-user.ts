import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { User } from '../../../shared/types';

export const useUser = () => {
  return useQuery<User, Error>({
    queryKey: ['/api/user/me'],
    queryFn: async ({ signal }) => {
      const response = await apiRequest('GET', '/api/user/me');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
  });
}