import React from 'react';
import { Box } from '@mui/material';

const DotsLoader = ({ size = 6, color = '#1976d2' }) => {
  const dotStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: color,
    animation: 'pulse 1.4s infinite ease-in-out both',
    marginRight: 4,
  };

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      '@keyframes pulse': {
        '0%, 80%, 100%': { transform: 'scale(0)' },
        '40%': { transform: 'scale(1)' },
      },
    }}>
      <Box sx={{ ...dotStyle, animationDelay: '0s' }} />
      <Box sx={{ ...dotStyle, animationDelay: '0.2s' }} />
      <Box sx={{ ...dotStyle, animationDelay: '0.4s' }} />
    </Box>
  );
};

export default DotsLoader;
