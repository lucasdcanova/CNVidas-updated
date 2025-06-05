import React, { useState } from 'react';

interface DashboardState {
  loading: boolean;
  error: string | null;
  stats: {
    totalUsers: number;
    totalAppointments: number;
    totalRevenue: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    stats: {
      totalUsers: 0,
      totalAppointments: 0,
      totalRevenue: 0
    }
  });

  return (
    <div>Admin Dashboard</div>
  );
};

export default AdminDashboard; 