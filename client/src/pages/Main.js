import React, { useState } from 'react';
import TitleAutocomplete from '../components/TitleAutocomplete';
import DotsLoader from '../components/DotsLoader';
import ResultsList from '../components/ResultsList';
import SubtitlesList from '../components/SubtitlesList';
import {
  Box, TextField, Button, useMediaQuery, Autocomplete,
  Snackbar, Alert, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { searchTorrentsAndSubs } from '../services/api';
import CheckIcon from '@mui/icons-material/Check';

function MainTab({ dropzoneActive = false }) {
  const [title, setTitle] = useState('');
  const [isSeries, setIsSeries] = useState(false);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [seasons, setSeasons] = useState([]);
  const [allTorrents, setAllTorrents] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [tab, setTab] = useState('torrents');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const notify = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const isEpisodeDownloaded = (title, season, episode) => {
    const data = JSON.parse(localStorage.getItem("downloadedEpisodes") || "{}");
    return data?.[title]?.[season]?.includes(episode);
  };

  const handleSearch = async () => {
    setSearchAttempted(true);
    if (isSeries && (!episode || !season)) {
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
      setAllTorrents(results.torrents);
      setAllSubs(results.subs);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoadingResults(false);
    }
  };

  const renderSeasonEpisode = () => (
    <Box sx={{ display: 'flex', gap: 2 }}>
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
          if (input === "") return options;
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
  );

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

          {isSeries && renderSeasonEpisode()}

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button disabled={loadingResults || selectedItem == null} variant="contained" onClick={handleSearch}>
              Search
            </Button>
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
              <ToggleButton sx={{ paddingBottom: 0, paddingTop: 0, textTransform: 'none' }} value="torrents">
                Torrents
              </ToggleButton>
              <ToggleButton sx={{ paddingBottom: 0, paddingTop: 0, textTransform: 'none' }} value="subs">
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
              isSeries={isSeries}
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
      {allTorrents.length === 0 && !loadingResults && (
        <img
          src="./logo.png"
          alt="WatchOffline Logo"
          style={{ width: 350, opacity: 0.7 }}
        />
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

export default MainTab;
