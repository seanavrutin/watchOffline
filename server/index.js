require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const searchRoute = require('./routes/search');
const downloadSubRoute = require('./routes/downloadSub');
const tmdbRoutes = require('./routes/tmdb');


app.use(cors());
app.use(express.json());

app.use('/api/search', searchRoute);
app.use('/api/downloadSub', downloadSubRoute);
app.use('/api/tmdb', tmdbRoutes);


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});