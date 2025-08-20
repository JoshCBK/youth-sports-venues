import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, nanoid() + ext);
  }
});
const upload = multer({ storage });

// Simple JSON "DB"
const DB_PATH = path.join(__dirname, 'db.json');
function loadDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Helpers
function computeAverages(venue) {
  const sums = { bathrooms: 0, food: 0, parking: 0, fields: 0 };
  const count = venue.reviews.length || 1;
  for (const r of venue.reviews) {
    sums.bathrooms += r.ratings.bathrooms || 0;
    sums.food += r.ratings.food || 0;
    sums.parking += r.ratings.parking || 0;
    sums.fields += r.ratings.fields || 0;
  }
  return {
    bathrooms: Math.round(sums.bathrooms / count),
    food: Math.round(sums.food / count),
    parking: Math.round(sums.parking / count),
    fields: Math.round(sums.fields / count),
  };
}

// Routes
app.get('/api/venues', (req, res) => {
  const db = loadDB();
  const list = db.venues.map(v => ({
    id: v.id,
    name: v.name,
    city: v.city,
    coords: v.coords,
    avgRatings: computeAverages(v),
    reviewCount: v.reviews.length,
  }));
  res.json(list);
});

app.get('/api/venues/:id', (req, res) => {
  const db = loadDB();
  const venue = db.venues.find(v => v.id === req.params.id);
  if (!venue) return res.status(404).json({ error: 'Not found' });
  res.json({ ...venue, avgRatings: computeAverages(venue) });
});

// Create a review (supports photo uploads)
// Multipart fields: author, text, bathrooms, food, parking, fields, photos[]
app.post('/api/venues/:id/reviews', upload.array('photos', 5), (req, res) => {
  const db = loadDB();
  const venue = db.venues.find(v => v.id === req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const ratings = {
    bathrooms: Number(req.body.bathrooms || 0),
    food: Number(req.body.food || 0),
    parking: Number(req.body.parking || 0),
    fields: Number(req.body.fields || 0),
  };
  const photos = (req.files || []).map(f => `/uploads/${f.filename}`);
  const review = {
    id: nanoid(),
    author: req.body.author || 'Anonymous',
    text: req.body.text || '',
    ratings,
    photos,
    createdAt: new Date().toISOString(),
  };
  venue.reviews.unshift(review);
  saveDB(db);
  res.status(201).json(review);
});

// Serve index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
