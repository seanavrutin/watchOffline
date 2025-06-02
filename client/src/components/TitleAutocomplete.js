import React, { useState, useEffect, useRef } from 'react';
import {Autocomplete,Avatar,Box,TextField,Typography,} from '@mui/material';
import axios from 'axios';
import CircularProgress from '@mui/material/CircularProgress';
import { searchTmdb } from '../services/api';


function TitleAutocomplete({ setTitle, setIsSeries, setSelectedItem }) {

    const [options, setOptions] = useState([]);
    const [inputChanged, setInputChanged] = useState(false);
    const lastTypeTimeRef = useRef(0);
    const titleRef = useRef('');
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        if (!inputChanged) return;
    
        const interval = setInterval(async () => {
          const now = Date.now();
          if (now - lastTypeTimeRef.current >= 500) {
            setInputChanged(false);
            const query = titleRef.current;

            if (!query || query.length == 0) {
              const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
              setOptions(recent);
              return;
            }
    
            if (query.length < 2) {
              setOptions([]);
              return;
            }
    
            setLoading(true);
            try {
              const res = await searchTmdb(query);
              setOptions(res);
            } catch (err) {
              console.error('TMDb search failed:', err);
              setOptions([]);
            } finally {
              setLoading(false);
            }
    
            clearInterval(interval);
          }
        }, 100);
    
        return () => clearInterval(interval);
      }, [inputChanged]);
    
      const handleInputChange = (e, value) => {
        setTitle(value);
        titleRef.current = value;
        lastTypeTimeRef.current = Date.now();
        setInputChanged(true);
      };
      
      const saveToLocalStorage = (val) => {
        const newEntry = {
          id: val.id,
          title: val.title,
          year: val.year,
          type: val.type,
          poster: val.poster,
        };
    
        const history = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        const updated = [newEntry, ...history.filter(e => e.id !== val.id)];
        localStorage.setItem('recentSearches', JSON.stringify(updated.slice(0, 5)));
      };


  return (
    <Autocomplete
      freeSolo
      options={options}
      getOptionLabel={(option) => option.title || ''}
      onInputChange={handleInputChange}
      onChange={(e, val) => {
        if (val) {
          setTitle(val.title);
          setIsSeries(val.type === 'tv');
          setSelectedItem(val);
          saveToLocalStorage(val);
        }
      }}
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={option.poster || undefined}
            variant="square"
            sx={{ width: 40, height: 60 }}
          />
          <Box>
            <Typography>{option.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.year} • {option.type}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Title"
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={20} sx={{ mr: 2, animationDuration: '250ms' }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}


export default TitleAutocomplete;
