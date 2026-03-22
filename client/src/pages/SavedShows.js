import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress,
  Dialog, DialogTitle, DialogActions, DialogContent, DialogContentText,
  Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShowCard from '../components/ShowCard';
import ShowDetail from '../components/ShowDetail';
import AddShowDialog from '../components/AddShowDialog';
import { getShows, removeShow } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function SavedShows() {
  const { isPermitted } = useAuth();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShow, setSelectedShow] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchShows = useCallback(async () => {
    try {
      const data = await getShows();
      setShows(data);
    } catch (err) {
      console.error('Failed to fetch shows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  const handleShowAdded = (newShow) => {
    setShows(prev => [newShow, ...prev]);
    setSnackbar({ open: true, message: `"${newShow.title}" added!`, severity: 'success' });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await removeShow(String(deleteTarget.tmdbId));
      setShows(prev => prev.filter(s => String(s.tmdbId) !== String(deleteTarget.tmdbId)));
      setSnackbar({ open: true, message: `"${deleteTarget.title}" removed`, severity: 'info' });
      if (selectedShow?.tmdbId === deleteTarget.tmdbId) {
        setSelectedShow(null);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to remove show';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (selectedShow) {
    return (
      <ShowDetail
        show={selectedShow}
        onBack={() => setSelectedShow(null)}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Saved Shows
        </Typography>
        {isPermitted && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ backgroundColor: '#00897b', '&:hover': { backgroundColor: '#00796b' } }}
          >
            Add Show
          </Button>
        )}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress sx={{ color: '#00897b' }} />
        </Box>
      ) : shows.length === 0 ? (
        <Box textAlign="center" mt={6}>
          <Typography color="text.secondary" variant="h6">
            No saved shows yet
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
            {isPermitted ? 'Click "Add Show" to start tracking your favorite series.' : 'Sign in to start adding shows.'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shows.map((show) => (
            <ShowCard
              key={show.tmdbId}
              show={show}
              onClick={() => setSelectedShow(show)}
              onDelete={(s) => setDeleteTarget(s)}
              canDelete={isPermitted}
            />
          ))}
        </Box>
      )}

      <AddShowDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onShowAdded={handleShowAdded}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove Show</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove "{deleteTarget?.title}" from your saved shows?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default SavedShows;
