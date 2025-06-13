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

const normalize = (str) =>
    str.toLowerCase().replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/);

const SubtitlesList = ({ subtitles, query = '' }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleSubtitleDownload = async (subtitle) => {
    try {
      const files = subtitle.attributes?.files;
      const fileId = Array.isArray(files) && files.length > 0 ? files[0].file_id : null;
      const release = subtitle.attributes.release;
      if(fileId){
          await downloadSubtitleForOpenSubtitles(fileId, release);
      }
      else if(subtitle.attributes.ktuvit_id){
          await downloadSubtitleForKtuvit(subtitle.attributes.filmID,subtitle.attributes.ktuvit_id,release)
      }
    } catch (err) {
      console.error('Subtitle download failed:', err);
    }
  };

  if (!subtitles.length) return null;
  const queryTokens = normalize(query);

  const filteredSubs = subtitles
    .filter((sub) => {
        const release = sub.attributes.release || '';
        const releaseTokens = normalize(release);
        return queryTokens.every((q) => releaseTokens.includes(q));
    })
    .sort((a, b) => (a.attributes.language === 'he' ? -1 : 1));

if (!filteredSubs.length) return null;

  return (
    <Box mt={4} width="100%" sx={{ marginTop: "5px" }}>
    {isMobile ? (
        <Box display="flex" flexDirection="column" gap={2}>
            {filteredSubs.map((subtitle, idx) => {
            const lang = subtitle.attributes.language;
            const flag =
                lang === 'he'
                ? 'https://flagcdn.com/w40/il.png'
                : 'https://flagcdn.com/w40/gb.png';

            return (
                <Card key={idx} variant="outlined">
                    <CardContent
                        sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingY: 1,
                        paddingX: 2,
                        backgroundColor: '#e0f7fa'
                        }}
                    >
                        <Avatar src={flag} sx={{ width: 24, height: 24, mr: 2 }} />

                        <Typography
                            variant="body2"
                            sx={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'normal' }}
                            >
                            {subtitle.attributes.release}
                        </Typography >

                        <IconButton onClick={() => handleSubtitleDownload(subtitle)} size="small">
                        <DownloadIcon fontSize="small" />
                        </IconButton>
                    </CardContent>
                </Card>
            );
            })}
        </Box>
    ) : (
        <TableContainer component={Paper}>
          <Table stickyHeader size="small">
            <TableBody>
              {filteredSubs.map((subtitle, idx) => (
                <TableRow sx={{
                    '&:hover': {
                      backgroundColor: '#f1f1f1', // Light gray or any color you prefer
                    },
                  }} key={idx}>
                  <TableCell>
                    <Avatar
                      src={
                        subtitle.attributes.language === 'he'
                          ? 'https://flagcdn.com/w40/il.png'
                          : 'https://flagcdn.com/w40/gb.png'
                      }
                      sx={{ width: 24, height: 24 }}
                    />
                  </TableCell>
                  <TableCell>{subtitle.attributes.release}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleSubtitleDownload(subtitle)} size="small">
                      <DownloadIcon fontSize="small" />
                    </IconButton>
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

export default SubtitlesList;
