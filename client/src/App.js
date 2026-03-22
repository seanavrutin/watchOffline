import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Sidebar, { DRAWER_WIDTH } from './components/Sidebar';
import Main from './pages/Main';
import SavedShows from './pages/SavedShows';
import QBittorrent from './pages/QBittorrent';
import Background from './components/Background';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isPermitted, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('main');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveOnServer, setSaveOnServer] = useState(() => localStorage.getItem('saveOnServer') === 'true');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (!loading) {
      setCurrentPage(isPermitted ? 'shows' : 'main');
    }
  }, [isPermitted, loading]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
        saveOnServer={saveOnServer}
        onSaveOnServerToggle={() => {
          const next = !saveOnServer;
          setSaveOnServer(next);
          localStorage.setItem('saveOnServer', String(next));
        }}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: isMobile ? 0 : `${DRAWER_WIDTH}px`,
          transition: 'margin 0.2s',
        }}
      >
        <Background />

        <Container
          maxWidth="lg"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: isMobile ? 8 : 4,
            pb: 4,
          }}
        >
          {currentPage === 'main' && (
            <>
              <Typography
                variant="h3"
                gutterBottom
                sx={{ fontFamily: "'Rubik Vinyl', cursive", textAlign: 'center' }}
              >
                WatchOffline
              </Typography>
              <Box mt={4} width="100%">
                <Main dropzoneActive={saveOnServer} />
              </Box>
            </>
          )}

          {currentPage === 'shows' && (
            <Box width="100%" maxWidth="md">
              <SavedShows />
            </Box>
          )}

          {currentPage === 'qbittorrent' && (
            <Box width="100%" maxWidth="md">
              <QBittorrent />
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
}

export default App;
