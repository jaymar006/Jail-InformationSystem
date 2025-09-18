const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const pdlRoutes = require('./routes/pdlRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const authRoutes = require('./routes/authRoutes');
const cellRoutes = require('./routes/cellRoutes');

const app = express();
const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

app.use('/pdls', pdlRoutes);
app.use('/api/cells', cellRoutes);
app.use('/api', visitorRoutes);
app.use('/auth', authRoutes);

// Test route to verify server is working
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Serve frontend static files if in production or build folder exists
const path = require('path');
const fs = require('fs');
const buildPath = path.join(__dirname, '..', 'frontend', 'build');

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  // Fallback route to serve index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


  