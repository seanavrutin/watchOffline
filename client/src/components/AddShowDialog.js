import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Autocomplete, TextField, Box, Avatar, Typography, CircularProgress,
} from '@mui/material';
import { searchTmdb, addShow } from '../services/api';

function AddShowDialog({ open, onClose, onShowAdded }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setOptions([]);
      setSelected(null);
      setInputValue('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!inputValue || inputValue.length < 2) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchTmdb(inputValue);
        setOptions(results.filter(r => r.type === 'tv'));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [inputValue]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const newShow = await addShow(selected.id);
      onShowAdded(newShow);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add show';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add a Show</DialogTitle>
      <DialogContent>
        <Autocomplete
          sx={{ mt: 1 }}
          options={options}
          getOptionLabel={(option) => option.title || ''}
          inputValue={inputValue}
          onInputChange={(_, value) => setInputValue(value)}
          onChange={(_, val) => { setSelected(val); setError(''); }}
          loading={loading}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar src={option.poster || undefined} variant="rounded" sx={{ width: 40, height: 56 }} />
              <Box>
                <Typography>{option.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.year} · TV
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for a TV show"
              placeholder="e.g. Breaking Bad"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        {selected && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center', p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Avatar src={selected.poster || undefined} variant="rounded" sx={{ width: 50, height: 70 }} />
            <Box>
              <Typography fontWeight={600}>{selected.title}</Typography>
              <Typography variant="body2" color="text.secondary">{selected.year} · TV Series</Typography>
            </Box>
          </Box>
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!selected || saving}
          sx={{ backgroundColor: '#00897b', '&:hover': { backgroundColor: '#00796b' } }}
        >
          {saving ? 'Adding...' : 'Add Show'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddShowDialog;
