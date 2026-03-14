import React, { useState } from 'react';
import TitleAutocomplete from '../components/TitleAutocomplete';
import DotsLoader from '../components/DotsLoader';
import ResultsList from '../components/ResultsList';
import SubtitlesList from '../components/SubtitlesList';
import TorrentListDialog from '../components/TorrentListDialog';
import {
  Box, TextField, Button, useMediaQuery, Autocomplete,
  Switch, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Typography, IconButton, Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { searchTorrentsAndSubs } from '../services/api';
import CheckIcon from '@mui/icons-material/Check';
import ListAltIcon from '@mui/icons-material/ListAlt';



function MainTab() {
  const [title, setTitle] = useState('');
  const [isSeries, setIsSeries] = useState(false);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [seasons, setSeasons] = useState([]);
  const [results, setResults] = useState({});
  const [allTorrents, setAllTorrents] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [tab, setTab] = useState('torrents');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [torrentListOpen, setTorrentListOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const dropzoneUnlocked = localStorage.getItem('dropzoneUnlocked') === 'true';

  const handleDropzoneToggle = () => {
    if (dropzoneActive) {
      setDropzoneActive(false);
      return;
    }
    if (dropzoneUnlocked) {
      setDropzoneActive(true);
    } else {
      setShowPinDialog(true);
    }
  };

  const handlePinSubmit = () => {
    if (pinInput === process.env.REACT_APP_DROPZONE_PIN) {
      localStorage.setItem('dropzoneUnlocked', 'true');
      setDropzoneActive(true);
      setShowPinDialog(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const notify = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };
  

  const isEpisodeDownloaded = (title, season, episode) => {
    const data = JSON.parse(localStorage.getItem("downloadedEpisodes") || "{}");
    return data?.[title]?.[season]?.includes(episode);
  };
  
  const handleSearch = async () => {
    setSearchAttempted(true);
    if(isSeries && (!episode || !season)){
      return;
    }

    const paddedSeason = season.padStart(2, '0');
    const paddedEpisode = episode.padStart(2, '0');

    setAllTorrents([]);
    setAllSubs([]);
    setLoadingResults(true);

    try {
      let tmdbId = selectedItem?.id ? selectedItem.id : undefined;
      let results = await searchTorrentsAndSubs(title, isSeries, paddedSeason, paddedEpisode, tmdbId);
      setResults(results);
      setAllTorrents(results.torrents);
      setAllSubs(results.subs);
    } catch (e) {
      console.error('Search failed:', e);
      setLoadingResults(false);
    }
    finally {
      setLoadingResults(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Box sx={{ width: '100%', mx: 'auto' }} maxWidth="md">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          <TitleAutocomplete
            setTitle={setTitle}
            setIsSeries={setIsSeries}
            setSelectedItem={setSelectedItem}
            setSeasons={setSeasons}
          />

          {isSeries && (
            isMobile ? (
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* <TextField
                  label="Season"
                  fullWidth
                  error={isSeries && searchAttempted && !season}
                  helperText={isSeries && searchAttempted && !season ? 'Required' : ''}
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                />
                <TextField
                  label="Episode"
                  fullWidth
                  error={isSeries && searchAttempted && !episode}
                  helperText={isSeries && searchAttempted && !episode ? 'Required' : ''}
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                /> */}
                <Autocomplete
                  fullWidth
                  options={seasons.filter(s => s.air_date !== null)}
                  getOptionLabel={(option) => option.season_number.toString()}
                  value={seasons.find(s => s.season_number === Number(season)) || null}
                  onInputChange={(e, newValue) => {
                    setSeason(newValue);
                    setEpisode('');
                  }}
                  onChange={(e, newValue) => {
                    setSeason(newValue ? newValue.season_number.toString() : '');
                    setEpisode('');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Season"
                      fullWidth
                      error={isSeries && searchAttempted && !season}
                      helperText={isSeries && searchAttempted && !season ? 'Required' : ''}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  options={
                    (() => {
                      const selectedSeason = seasons.find(s => s.season_number === Number(season));
                      return selectedSeason
                        ? Array.from({ length: selectedSeason.episode_count }, (_, i) => (i + 1).toString().padStart(2, '0'))
                        : [];
                    })()
                  }
                  value={episode}
                  onInputChange={(e, newValue) => setEpisode(newValue || '')}
                  onChange={(e, newValue) => setEpisode(newValue || '')}
                  filterOptions={(options, state) => {
                    let input = state.inputValue.trim();
                    if(input === "") return options;
                    return options.filter(opt => opt === input || opt === input.padStart(2, '0'));
                  }}
                  renderOption={(props, option) => (
                    <li {...props}>
                      {option}
                      {isEpisodeDownloaded(title, season, option) && (
                        <CheckIcon fontSize="small" sx={{ marginLeft: 'auto', color: 'green' }} />
                      )}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Episode"
                      fullWidth
                      error={isSeries && searchAttempted && !episode}
                      helperText={isSeries && searchAttempted && !episode ? 'Required' : ''}
                    />
                  )}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* <TextField
                  label="Season"
                  fullWidth
                  error={isSeries && searchAttempted && !season}
                  helperText={isSeries && searchAttempted && !season ? 'Required' : ''}
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                />
                <TextField
                  label="Episode"
                  fullWidth
                  error={isSeries && searchAttempted && !episode}
                  helperText={isSeries && searchAttempted && !episode ? 'Required' : ''}
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                /> */}
                <Autocomplete
                  fullWidth
                  options={seasons.filter(s => s.air_date !== null)}
                  getOptionLabel={(option) => option.season_number.toString()}
                  value={seasons.find(s => s.season_number === Number(season)) || null}
                  onInputChange={(e, newValue) => {
                    setSeason(newValue);
                    setEpisode('');
                  }}
                  onChange={(e, newValue) => {
                    setSeason(newValue ? newValue.season_number.toString() : '');
                    setEpisode('');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Season"
                      fullWidth
                      error={isSeries && searchAttempted && !season}
                      helperText={isSeries && searchAttempted && !season ? 'Required' : ''}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  options={
                    (() => {
                      const selectedSeason = seasons.find(s => s.season_number === Number(season));
                      return selectedSeason
                        ? Array.from({ length: selectedSeason.episode_count }, (_, i) => (i + 1).toString().padStart(2, '0'))
                        : [];
                    })()
                  }
                  value={episode}
                  onInputChange={(e, newValue) => setEpisode(newValue || '')}
                  onChange={(e, newValue) => setEpisode(newValue || '')}
                  filterOptions={(options, state) => {
                    let input = state.inputValue.trim();
                    if(input === "") return options;
                    return options.filter(opt => opt === input || opt === input.padStart(2, '0'));
                  }}
                  renderOption={(props, option) => (
                    <li {...props}>
                      {option}
                      {isEpisodeDownloaded(title, season, option) && (
                        <CheckIcon fontSize="small" sx={{ marginLeft: 'auto', color: 'green' }} />
                      )}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Episode"
                      fullWidth
                      error={isSeries && searchAttempted && !episode}
                      helperText={isSeries && searchAttempted && !episode ? 'Required' : ''}
                    />
                  )}
                />
              </Box>
            )
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
            <Button disabled={loadingResults || selectedItem == null} variant="contained" onClick={handleSearch}>
              Search
            </Button>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography
                variant="body2"
                sx={{ color: dropzoneActive ? '#00897b' : 'text.secondary', fontWeight: dropzoneActive ? 600 : 400 }}
              >
                DropZone
              </Typography>
              <Switch
                size="small"
                checked={dropzoneActive}
                onChange={handleDropzoneToggle}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#00897b' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00897b' },
                }}
              />
            </Box>
            {dropzoneActive && (
              <Tooltip title="Manage torrents">
                <IconButton size="small" onClick={() => setTorrentListOpen(true)} sx={{ color: '#00897b' }}>
                  <ListAltIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {loadingResults && (
        <Box mt={4} display="flex" justifyContent="center">
          <DotsLoader size={8} />
        </Box>
      )}

      {allTorrents.length > 0 && (
        <>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <ToggleButtonGroup
              value={tab}
              exclusive
              onChange={(e, value) => value && setTab(value)}
              size="small"
            >
              <ToggleButton
                sx={{ paddingBottom: 0, paddingTop: 0, textTransform: 'none' }}
                value="torrents"
              >
                Torrents
              </ToggleButton>
              <ToggleButton
                sx={{ paddingBottom: 0, paddingTop: 0, textTransform: 'none' }}
                value="subs"
              >
                Subtitles
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {tab === 'torrents' && (
            <ResultsList
              results={allTorrents}
              title={title}
              season={season}
              episode={episode}
              dropzoneActive={dropzoneActive}
              onNotify={notify}
            />
          )}
          {tab === 'subs' && (
            <SubtitlesList
              subtitles={allSubs}
              query={title}
              dropzoneActive={dropzoneActive}
              onNotify={notify}
            />
          )}
        </>
      )}
      {allTorrents.length === 0 && (
        <img
          src="./logo.png"
          alt="WatchOffline Logo"
          style={{ width: 350, opacity: 0.7 }}
        />
      )}

      <Dialog
        open={showPinDialog}
        onClose={() => { setShowPinDialog(false); setPinInput(''); setPinError(false); }}
      >
        <DialogTitle>Enter DropZone PIN</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="PIN"
            type="password"
            fullWidth
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit(); }}
            error={pinError}
            helperText={pinError ? 'Invalid PIN' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowPinDialog(false); setPinInput(''); setPinError(false); }}>Cancel</Button>
          <Button onClick={handlePinSubmit} variant="contained">Confirm</Button>
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

      <TorrentListDialog
        open={torrentListOpen}
        onClose={() => setTorrentListOpen(false)}
        onNotify={notify}
      />
    </Box>
  );
}

export default MainTab;
