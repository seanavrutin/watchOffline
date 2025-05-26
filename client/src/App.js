import React, { useState } from 'react';
import { Container, Typography,Box } from '@mui/material';
import Main from './pages/Main';
import Background from "./components/Background";


function App() {
  const [tab, setTab] = useState(0);

  return (
    <Container
      // maxWidth="md"
      sx={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 4,
      }}
    >
      <Background />

      <Typography
        variant="h3"
        gutterBottom
        sx={{ fontFamily: "'Rubik Vinyl', cursive", textAlign: 'center' }}
      >
        WatchOffline
      </Typography>
      <Box mt={4} width="100%">
        <Main />
      </Box>
    </Container>
  );
}

export default App;