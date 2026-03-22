import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, Accordion, AccordionSummary,
  AccordionDetails, Avatar, CircularProgress, Snackbar, Alert, Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import EventIcon from '@mui/icons-material/Event';
import { getShowStatus, downloadEpisode } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function formatAirDate(dateStr) {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ShowDetail({ show, onBack }) {
  const { isPermitted } = useAuth();
  const [expandedSeason, setExpandedSeason] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [downloadingEps, setDownloadingEps] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getShowStatus(show.tmdbId);
      setStatusData(data);
    } catch (err) {
      console.error('Failed to fetch show status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, [show.tmdbId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDownload = async (seasonNum, epNum) => {
    const key = `S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
    setDownloadingEps(prev => ({ ...prev, [key]: true }));
    try {
      const result = await downloadEpisode(show.tmdbId, seasonNum, epNum);
      setSnackbar({
        open: true,
        message: result.torrentName
          ? `Downloading: ${result.torrentName}`
          : `Download started for ${key}`,
        severity: 'success',
      });
      setTimeout(fetchStatus, 3000);
    } catch (err) {
      const msg = err.response?.data?.error || `Failed to download ${key}`;
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setDownloadingEps(prev => ({ ...prev, [key]: false }));
    }
  };

  const validSeasons = (show.seasons || []).filter(s => s.seasonNumber > 0);

  const getSeasonEpisodes = (seasonNum) => {
    if (!statusData) return null;
    return statusData.seasons?.find(s => s.seasonNumber === seasonNum)?.episodes || null;
  };

  const getSeasonSummary = (seasonNum) => {
    const episodes = getSeasonEpisodes(seasonNum);
    if (!episodes) return null;
    const downloaded = episodes.filter(e => e.status === 'downloaded').length;
    const downloading = episodes.filter(e => e.status === 'downloading').length;
    return { downloaded, downloading, total: episodes.length };
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={onBack} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={600}>
          {show.title}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-start' }}>
        {show.posterPath && (
          <Box
            component="img"
            src={show.posterPath}
            alt={show.title}
            sx={{ width: 80, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
            {show.genres?.slice(0, 3).map((genre) => (
              <Chip key={genre} label={genre} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {show.firstAirDate && (
              <Typography variant="caption" color="text.secondary">
                {show.firstAirDate.split('-')[0]}
              </Typography>
            )}
            {show.voteAverage > 0 && (
              <Typography variant="caption" color="text.secondary">
                ★ {show.voteAverage.toFixed(1)}
              </Typography>
            )}
            {show.networks?.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {show.networks[0]}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {show.status}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Seasons ({validSeasons.length})
        </Typography>
        {loadingStatus && <CircularProgress size={18} sx={{ color: '#00897b' }} />}
      </Box>

      {validSeasons.map((season) => {
        const summary = getSeasonSummary(season.seasonNumber);
        const episodes = getSeasonEpisodes(season.seasonNumber);

        return (
          <Accordion
            key={season.seasonNumber}
            expanded={expandedSeason === season.seasonNumber}
            onChange={(_, expanded) => setExpandedSeason(expanded ? season.seasonNumber : null)}
            disableGutters
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px !important',
              mb: 1,
              overflow: 'hidden',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                {season.posterPath && (
                  <Avatar src={season.posterPath} variant="rounded" sx={{ width: 40, height: 56 }} />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={500}>{season.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {season.episodeCount} ep{season.episodeCount !== 1 ? 's' : ''}
                    {season.airDate ? ` · ${season.airDate.split('-')[0]}` : ''}
                    {summary && summary.downloaded > 0 && (
                      <Typography component="span" variant="caption" sx={{ color: '#4caf50', ml: 1 }}>
                        {summary.downloaded}/{summary.total}
                      </Typography>
                    )}
                    {summary && summary.downloading > 0 && (
                      <Typography component="span" variant="caption" sx={{ color: '#2196f3', ml: 1 }}>
                        {summary.downloading} dl
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {episodes ? episodes.map((ep) => {
                const isDownloading = downloadingEps[ep.key];
                return (
                  <EpisodeRow
                    key={ep.episodeNumber}
                    ep={ep}
                    isDownloading={isDownloading}
                    canDownload={isPermitted}
                    onDownload={() => handleDownload(season.seasonNumber, ep.episodeNumber)}
                  />
                );
              }) : (
                Array.from({ length: season.episodeCount }, (_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">
                      Episode {i + 1}
                    </Typography>
                  </Box>
                ))
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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

function EpisodeRow({ ep, canDownload, isDownloading, onDownload }) {
  const isDownloaded = ep.status === 'downloaded';
  const isInProgress = ep.status === 'downloading';
  const isNotAired = ep.status === 'not_aired';
  const isMissing = ep.status === 'missing';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1,
        gap: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: isDownloaded ? 'rgba(76, 175, 80, 0.04)' : isInProgress ? 'rgba(33, 150, 243, 0.04)' : 'transparent',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          minWidth: 32,
          color: isDownloaded ? '#4caf50' : isInProgress ? '#2196f3' : isNotAired ? 'text.disabled' : 'text.primary',
        }}
      >
        {String(ep.episodeNumber).padStart(2, '0')}
      </Typography>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ color: isNotAired ? 'text.disabled' : 'text.primary' }}
        >
          {ep.name || `Episode ${ep.episodeNumber}`}
        </Typography>

        {isInProgress && (
          <Typography variant="caption" sx={{ color: '#2196f3' }}>
            {ep.progress}% downloaded
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {isDownloaded && (
          <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 22 }} />
        )}

        {isInProgress && (
          <SyncIcon sx={{ color: '#2196f3', fontSize: 22, animation: 'spin 2s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
        )}

        {isNotAired && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EventIcon sx={{ color: 'text.disabled', fontSize: 16 }} />
            <Typography variant="caption" color="text.disabled">
              {ep.airDate ? formatAirDate(ep.airDate) : 'TBA'}
            </Typography>
          </Box>
        )}

        {isMissing && canDownload && !isDownloading && (
          <IconButton size="small" onClick={onDownload} sx={{ color: '#00897b' }}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        )}

        {isDownloading && (
          <CircularProgress size={20} sx={{ color: '#00897b' }} />
        )}
      </Box>
    </Box>
  );
}

export default ShowDetail;
