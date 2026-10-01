import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

export default function RoleRoute({ roles, children }: { roles: Role[]; children: React.ReactElement }): React.ReactElement {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
