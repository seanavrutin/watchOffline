import React from 'react';
import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Typography, Button, Divider, IconButton, useMediaQuery, Switch,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadingIcon from '@mui/icons-material/Downloading';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 240;

function Sidebar({ currentPage, onNavigate, mobileOpen, onMobileToggle, saveOnServer, onSaveOnServerToggle }) {
  const { user, loading, isPermitted, signIn, signOut } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const navItems = [
    { id: 'main', label: 'Search', icon: <SearchIcon /> },
    ...(isPermitted ? [
      { id: 'shows', label: 'Saved Shows', icon: <VideoLibraryIcon /> },
      { id: 'qbittorrent', label: 'qBittorrent', icon: <DownloadingIcon /> },
    ] : []),
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography
          variant="h6"
          sx={{ fontFamily: "'Rubik Vinyl', cursive", color: 'text.primary' }}
        >
          WatchOffline
        </Typography>
      </Box>

      <Divider />

      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={currentPage === item.id}
            onClick={() => {
              onNavigate(item.id);
              if (isMobile) onMobileToggle();
            }}
            sx={{
              mx: 1,
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 137, 123, 0.12)',
                '&:hover': { backgroundColor: 'rgba(0, 137, 123, 0.18)' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: currentPage === item.id ? '#00897b' : 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontWeight: currentPage === item.id ? 600 : 400,
                color: currentPage === item.id ? '#00897b' : 'text.primary',
              }}
            />
          </ListItemButton>
        ))}
      </List>

      {isPermitted && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography
              variant="body2"
              sx={{ color: saveOnServer ? '#00897b' : 'text.secondary', fontWeight: saveOnServer ? 600 : 400 }}
            >
              Save on server
            </Typography>
            <Switch
              size="small"
              checked={saveOnServer}
              onChange={onSaveOnServerToggle}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#00897b' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00897b' },
              }}
            />
          </Box>
        </>
      )}

      <Divider />

      <Box sx={{ p: 2 }}>
        {loading ? null : user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              src={user.photoURL}
              alt={user.displayName}
              sx={{ width: 36, height: 36 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap fontWeight={500}>
                {user.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            </Box>
            <IconButton size="small" onClick={signOut} title="Sign out">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Button
            fullWidth
            variant="outlined"
            onClick={signIn}
            startIcon={
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt=""
                width={18}
                height={18}
              />
            }
            sx={{
              textTransform: 'none',
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { borderColor: 'text.secondary', backgroundColor: 'rgba(0,0,0,0.04)' },
            }}
          >
            Sign in with Google
          </Button>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {isMobile && (
        <IconButton
          onClick={onMobileToggle}
          sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1300 }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={onMobileToggle}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}

export { DRAWER_WIDTH };
export default Sidebar;
