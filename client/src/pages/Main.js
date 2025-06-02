import React, { useState } from 'react';
import TitleAutocomplete from '../components/TitleAutocomplete';
import DotsLoader from '../components/DotsLoader';
import ResultsList from '../components/ResultsList';
import SubtitlesList from '../components/SubtitlesList';
import {Box,TextField,Button,useMediaQuery,} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { searchTorrentsAndSubs } from '../services/api';

function MainTab() {
  const [title, setTitle] = useState('');
  const [isSeries, setIsSeries] = useState(false);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [results, setResults] = useState({});
  const [allTorrents, setAllTorrents] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [tab, setTab] = useState('torrents');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  

  const handleSearch = async () => {
    setSearchAttempted(true);
    if(isSeries && (!episode || !season)){
      return;
    }
    setLoadingResults(true);

    try {
      let tmdbId = selectedItem?.id ? selectedItem.id : undefined;
      let results = await searchTorrentsAndSubs(title, isSeries, season, episode, tmdbId);
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
          />

          {isSeries && (
            isMobile ? (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
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
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
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
                />
              </Box>
            )
          )}

            {/* <ToggleButtonGroup
                value={isSeries ? 'series' : 'movie'}
                exclusive
                onChange={(e, value) => {
                    if (value !== null) setIsSeries(value === 'series');
                }}
                size="small"
                sx={{ height: 40 }}
            >
                <ToggleButton value="movie"  sx={{ textTransform: 'none' }}>Movie</ToggleButton>
                <ToggleButton value="series"  sx={{ textTransform: 'none' }}>Series</ToggleButton>
            </ToggleButtonGroup> */}

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button disabled={loadingResults} variant="contained" onClick={handleSearch}>
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
            <ResultsList results={allTorrents} />
          )}
          {tab === 'subs' && (
            <SubtitlesList subtitles={allSubs} query={title} />
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
    </Box>
  );
}

export default MainTab;
