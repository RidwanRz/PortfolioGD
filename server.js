const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve the current directory as static files so index.html works normally
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'database.json');

// Ensure database.json exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ projects: [], categories: [], heroSlides: [] }, null, 2));
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const projectName = req.body.project || 'Uncategorized';
    const subfolder = req.body.type || '';
    // Replace invalid characters in folder name
    const safeProjectName = projectName.replace(/[^a-z0-9]/gi, '_');
    const dir = path.join(__dirname, 'images', safeProjectName, subfolder);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Preserve the original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// API: Get Database
app.get('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read database' });
  }
});

// API: Save Database
app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save database' });
  }
});

// API: Increment Project View
app.post('/api/view/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const projectId = req.params.id;
    let found = false;
    
    if (data.projects) {
      for (let p of data.projects) {
        if (p.id === projectId) {
          p.views = (p.views || 0) + 1;
          found = true;
          break;
        }
      }
    }
    
    if (found) {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update views' });
  }
});

// API: Upload Image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const projectName = req.body.project || 'Uncategorized';
  const subfolder = req.body.type || '';
  const safeProjectName = projectName.replace(/[^a-z0-9]/gi, '_');
  
  // Return the path relative to the website root, so it can be used in <img src="...">
  const relativePath = subfolder ? `images/${safeProjectName}/${subfolder}/${req.file.originalname}` : `images/${safeProjectName}/${req.file.originalname}`;
  
  res.json({ success: true, path: relativePath });
});

// API: Delete Project Images
app.delete('/api/images/:project', (req, res) => {
  const projectName = req.params.project;
  const safeProjectName = projectName.replace(/[^a-z0-9]/gi, '_');
  const dir = path.join(__dirname, 'images', safeProjectName);
  
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete images' });
    }
  } else {
    res.json({ success: true, message: 'Directory did not exist' });
  }
});

// API: Delete specific file
app.delete('/api/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Path required' });
  
  if (!filePath.startsWith('images/') || filePath.includes('..')) {
    return res.status(403).json({ error: 'Invalid path' });
  }

  const absolutePath = path.join(__dirname, filePath);
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  } else {
    res.json({ success: true, message: 'File did not exist' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
