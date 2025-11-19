import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LogoutButton({ className }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoading(true);
    try {
      
      localStorage.removeItem('email');
      localStorage.removeItem('role');
    } finally {
      navigate('/login', { replace: true });
      setLoading(false);
    }
  };

  return (
    <button type="button" className={className} onClick={handleLogout} disabled={loading}>
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
}