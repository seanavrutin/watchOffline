import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, LinearProgress,
  Snackbar, Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { getDropzoneTorrents, deleteDropzoneTorrent } from '../services/api';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatEta(seconds) {
  if (!seconds || seconds <= 0 || seconds >= 8640000) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function stateLabel(state) {
  const map = {
    downloading: 'Downloading',
    stalledDL: 'Stalled',
    uploading: 'Seeding',
    stalledUP: 'Seeding',
    pausedDL: 'Paused',
    pausedUP: 'Completed',
    queuedDL: 'Queued',
    queuedUP: 'Queued',
    checkingDL: 'Checking',
    checkingUP: 'Checking',
    error: 'Error',
    missingFiles: 'Missing',
    metaDL: 'Metadata',
  };
  return map[state] || state;
}

function stateColor(state) {
  if (['downloading', 'metaDL'].includes(state)) return '#2196f3';
  if (['uploading', 'stalledUP', 'pausedUP'].includes(state)) return '#4caf50';
  if (['error', 'missingFiles'].includes(state)) return '#d32f2f';
  if (['pausedDL'].includes(state)) return '#f57c00';
  return 'text.secondary';
}

function QBittorrent() {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(new Set());
  const [expandedName, setExpandedName] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchTorrents = useCallback(async () => {
    try {
      const data = await getDropzoneTorrents();
      setTorrents(data);
    } catch {
      // silent on polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 5000);
    return () => clearInterval(interval);
  }, [fetchTorrents]);

  const handleDelete = async (hash, name) => {
    setDeleting(prev => new Set(prev).add(hash));
    try {
      await deleteDropzoneTorrent(hash);
      setTorrents(prev => prev.filter(t => t.hash !== hash));
      setSnackbar({ open: true, message: `Deleted: ${name}`, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete torrent', severity: 'error' });
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(hash); return n; });
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        qBittorrent
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress sx={{ color: '#00897b' }} />
        </Box>
      ) : torrents.length === 0 ? (
        <Box textAlign="center" mt={6}>
          <Typography color="text.secondary" variant="h6">No active torrents</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {torrents.map((t) => (
            <Box
              key={t.hash}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                overflow: 'hidden',
                backgroundColor: t.progress >= 1 ? 'rgba(76,175,80,0.04)' : 'transparent',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1, width: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    onClick={() => setExpandedName(expandedName === t.hash ? null : t.hash)}
                    noWrap={expandedName !== t.hash}
                    sx={{ cursor: 'pointer', wordBreak: 'break-word' }}
                  >
                    {t.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: stateColor(t.state) }}>
                      {stateLabel(t.state)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatSize(t.size)}
                    </Typography>
                    {t.dlspeed > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {formatSize(t.dlspeed)}/s
                      </Typography>
                    )}
                    {t.eta > 0 && t.eta < 8640000 && (
                      <Typography variant="caption" color="text.secondary">
                        ETA: {formatEta(t.eta)}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(t.hash, t.name)}
                  disabled={deleting.has(t.hash)}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                >
                  {deleting.has(t.hash) ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </Box>
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.round(t.progress * 100)}
                  sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" sx={{ minWidth: 36, textAlign: 'right' }}>
                  {Math.round(t.progress * 100)}%
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

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

export default QBittorrent;
