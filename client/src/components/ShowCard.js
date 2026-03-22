import React from 'react';
import {
  Card, CardActionArea, Box, Typography, Chip, IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const statusColors = {
  'Returning Series': '#00897b',
  'Ended': '#757575',
  'Canceled': '#d32f2f',
  'In Production': '#f57c00',
};

function ShowCard({ show, onClick, onDelete, canDelete }) {
  return (
    <Card
      elevation={1}
      sx={{
        display: 'flex',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ display: 'flex', alignItems: 'stretch' }}>
        {show.posterPath ? (
          <Box
            component="img"
            src={show.posterPath}
            alt={show.title}
            sx={{
              width: 60,
              minHeight: 90,
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 60,
              minHeight: 90,
              backgroundColor: 'grey.200',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>No img</Typography>
          </Box>
        )}

        <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {show.title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {show.genres?.slice(0, 2).map((genre) => (
              <Chip
                key={genre}
                label={genre}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            ))}
            <Chip
              label={show.status}
              size="small"
              sx={{
                ml: 'auto',
                fontSize: '0.6rem',
                height: 20,
                fontWeight: 600,
                color: '#fff',
                backgroundColor: statusColors[show.status] || '#9e9e9e',
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              {show.numberOfSeasons}S · {show.firstAirDate?.split('-')[0]}
            </Typography>
            {show.voteAverage > 0 && (
              <Typography variant="caption" color="text.secondary">
                ★ {show.voteAverage.toFixed(1)}
              </Typography>
            )}
          </Box>
        </Box>
      </CardActionArea>

      {canDelete && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', p: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(show); }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Card>
  );
}

export default ShowCard;
