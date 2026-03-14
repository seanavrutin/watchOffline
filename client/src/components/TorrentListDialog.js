import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, LinearProgress, Box, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return '-';
  return `${formatSize(bytesPerSec)}/s`;
}

function stateLabel(state) {
  const map = {
    downloading: 'Downloading',
    stalledDL: 'Stalled (DL)',
    uploading: 'Seeding',
    stalledUP: 'Seeding',
    pausedDL: 'Paused',
    pausedUP: 'Completed',
    queuedDL: 'Queued',
    queuedUP: 'Queued',
    checkingDL: 'Checking',
    checkingUP: 'Checking',
    error: 'Error',
    missingFiles: 'Missing files',
    metaDL: 'Fetching metadata',
  };
  return map[state] || state;
}

export default function TorrentListDialog({ open, onClose, onNotify }) {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(new Set());

  const fetchTorrents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDropzoneTorrents();
      setTorrents(data);
    } catch {
      onNotify('Failed to load torrents', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    if (!open) return;
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 5000);
    return () => clearInterval(interval);
  }, [open, fetchTorrents]);

  const handleDelete = async (hash, name) => {
    setDeleting(prev => new Set(prev).add(hash));
    try {
      await deleteDropzoneTorrent(hash);
      setTorrents(prev => prev.filter(t => t.hash !== hash));
      onNotify(`Deleted ${name}`);
    } catch {
      onNotify('Failed to delete torrent', 'error');
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(hash); return n; });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        qBittorrent Torrents
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && torrents.length === 0 ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : torrents.length === 0 ? (
          <Typography align="center" color="text.secondary" py={4}>
            No torrents found
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="center" sx={{ minWidth: 100 }}>Progress</TableCell>
                  <TableCell align="right">Size</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Speed</TableCell>
                  <TableCell align="right">ETA</TableCell>
                  <TableCell align="center" sx={{ width: 48 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {torrents.map((t) => (
                  <TableRow key={t.hash}>
                    <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" title={t.name} noWrap>{t.name}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" alignItems="center" gap={1}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.round(t.progress * 100)}
                          sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" sx={{ minWidth: 36 }}>
                          {Math.round(t.progress * 100)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>{formatSize(t.size)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" noWrap>{stateLabel(t.state)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>{formatSpeed(t.dlspeed)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>{formatEta(t.eta)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(t.hash, t.name)}
                        disabled={deleting.has(t.hash)}
                      >
                        {deleting.has(t.hash) ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
