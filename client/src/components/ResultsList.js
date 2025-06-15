import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Avatar,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import { downloadSubtitleForOpenSubtitles } from '../services/api';
import { downloadSubtitleForKtuvit } from '../services/api';

const formatSize = (sizeStr) => {
  const [value] = sizeStr.split(' ');
  const mb = parseFloat(value);
  if (isNaN(mb)) return sizeStr;
  const gb = mb / 1024;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
};

const handleSubtitleDownload = async (subtitle) => {
    try {
        if(subtitle.file_id){
            await downloadSubtitleForOpenSubtitles(subtitle.file_id, subtitle.release);
        }
        else if(subtitle.ktuvit_id){
            await downloadSubtitleForKtuvit(subtitle.filmID,subtitle.ktuvit_id,subtitle.release)
        }
    } catch (err) {
      console.error('Subtitle download failed:', err);
    }
  };

const ResultsList = ({ results, title, season, episode }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleLocalStorage = () => {
    const key = "downloadedEpisodes";
    const data = JSON.parse(localStorage.getItem(key) || "{}");

    if (!data[title]) data[title] = {};
    if (!data[title][season]) data[title][season] = [];
    if (!data[title][season].includes(episode)) {
        data[title][season].push(episode);
        data[title][season].sort((a, b) => a - b);
    }

    localStorage.setItem(key, JSON.stringify(data));
  };


  if (!results.length) return null;

  return (
    <Box mt={4} width="100%" sx={{ marginTop: "5px" }}>
        {isMobile ? (
        <Box display="flex" flexDirection="column" gap={2}>
            {results.map((item, idx) => (
            <Card key={idx} variant="outlined">
                <CardHeader
                    title={item.title}
                    sx={{ backgroundColor: '#e0f7fa', padding: 1, textAlign: 'center' }}
                    titleTypographyProps={{ variant: 'subtitle2' }}
                />
                <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" px={1}>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                    {formatSize(item.size)} • <span style={{ color: 'green' }}>{item.seeders}</span> / <span style={{ color: 'red' }}>{item.leechers}</span>
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1}>
                    {item.subtitles?.he && (
                        <Tooltip title={item.subtitles.he.release}>
                        <IconButton onClick={() => handleSubtitleDownload(item.subtitles.he)}>
                            <Avatar src="https://flagcdn.com/w40/il.png" sx={{ width: 24, height: 24 }} />
                        </IconButton>
                        </Tooltip>
                    )}
                    {item.subtitles?.en && (
                        <Tooltip title={item.subtitles.en.release}>
                        <IconButton onClick={() => handleSubtitleDownload(item.subtitles.en)}>
                            <Avatar src="https://flagcdn.com/w40/gb.png" sx={{ width: 24, height: 24 }} />
                        </IconButton>
                        </Tooltip>
                    )}

                    {(item.subtitles?.en || item.subtitles?.he) && (
                        <Typography color="text.secondary" fontSize={16}>|</Typography>
                    )}

                    <IconButton onClick={handleLocalStorage()} href={item.magnetLink} target="_blank" rel="noopener noreferrer">
                        <DownloadIcon />
                    </IconButton>
                    </Box>
                </Box>
                </CardContent>
            </Card>
            ))}
        </Box>
        ) : (
        <TableContainer component={Paper} >
            <Table hover stickyHeader size="small">
            <TableHead>
                <TableRow sx={{ backgroundColor: '#e0f7fa' }}>
                <TableCell sx={{ backgroundColor: '#e0f7fa' }}>Name</TableCell>
                <TableCell sx={{ backgroundColor: '#e0f7fa' }}>Size</TableCell>
                <TableCell sx={{ backgroundColor: '#e0f7fa' }}>Seeders</TableCell>
                <TableCell sx={{ backgroundColor: '#e0f7fa' }}>Leechers</TableCell>
                <TableCell sx={{ backgroundColor: '#e0f7fa' }}>Download</TableCell>
                <TableCell sx={{ backgroundColor: '#e0f7fa' }}>Subtitles</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {results.map((item, idx) => (
                <TableRow sx={{
                    '&:hover': {
                      backgroundColor: '#f1f1f1', // Light gray or any color you prefer
                    },
                  }} key={idx}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{formatSize(item.size)}</TableCell>
                    <TableCell sx={{ color: 'green' }}>{item.seeders}</TableCell>
                    <TableCell sx={{ color: 'red' }}>{item.leechers}</TableCell>
                    <TableCell>
                    <IconButton href={item.magnetLink} target="_blank" rel="noopener noreferrer" size="small">
                        <DownloadIcon fontSize="small" />
                    </IconButton>
                    </TableCell>
                    <TableCell>
                    <Box display="flex" gap={1}>
                        {item.subtitles?.he && (
                        <Tooltip title={item.subtitles.he.release}>
                            <IconButton onClick={() => handleSubtitleDownload(item.subtitles.he)} size="small">
                            <Avatar src="https://flagcdn.com/w40/il.png" sx={{ width: 24, height: 24 }} />
                            </IconButton>
                        </Tooltip>
                        )}
                        {item.subtitles?.en && (
                        <Tooltip title={item.subtitles.en.release}>
                            <IconButton onClick={() => handleSubtitleDownload(item.subtitles.en)} size="small">
                            <Avatar src="https://flagcdn.com/w40/gb.png" sx={{ width: 24, height: 24 }} />
                            </IconButton>
                        </Tooltip>
                        )}
                    </Box>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </TableContainer>
        )}
    </Box>
  );
};

export default ResultsList;
