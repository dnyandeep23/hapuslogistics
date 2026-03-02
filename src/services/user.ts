// src/services/user.ts

export const verifyEmail = async (token: string) => {
  const response = await fetch('/api/auth/verifyemail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Something went wrong during email verification.');
  }

  return response.json();
};

export const getMe = async () => {
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.reason || 'Something went wrong while fetching user.');
  }

  return response.json();
};
