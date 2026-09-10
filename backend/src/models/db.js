import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoClient = null;
let mongoDb = null;
let isMongoConnected = false;
const localDbPath = path.resolve(__dirname, '../../data/local_db.json');

// Standard collections required by GroupRoute
const COLLECTION_NAMES = [
  'users',
  'groups',
  'group_members',
  'trips',
  'trip_members',
  'locations',
  'stops',
  'trip_events',
  'chat_messages'
];

const initialLocalDb = {
  users: [],
  groups: [],
  group_members: [],
  trips: [],
  trip_members: [],
  locations: [],
  stops: [],
  trip_events: [],
  chat_messages: []
};

let localDbCache = null;

function loadLocalDb() {
  if (localDbCache) return localDbCache;
  try {
    const dir = path.dirname(localDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(localDbPath)) {
      const data = fs.readFileSync(localDbPath, 'utf8');
      localDbCache = JSON.parse(data);
    } else {
      localDbCache = { ...initialLocalDb };
      fs.writeFileSync(localDbPath, JSON.stringify(localDbCache, null, 2));
    }
  } catch (err) {
    console.warn('[DB] Fallback storage read error, using in-memory store:', err.message);
    localDbCache = { ...initialLocalDb };
  }
  return localDbCache;
}

function saveLocalDb() {
  if (!localDbCache) return;
  try {
    const dir = path.dirname(localDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localDbPath, JSON.stringify(localDbCache, null, 2));
  } catch (err) {
    console.error('[DB] Fallback storage write error:', err.message);
  }
}

// Initialize Database connection (MongoDB primary, embedded local sync)
export async function initDb() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri && mongoUri.trim().length > 0) {
    try {
      console.log('[DB] Connecting to MongoDB cluster...');
      mongoClient = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
      });

      await mongoClient.connect();
      mongoDb = mongoClient.db('grouproute');
      isMongoConnected = true;
      console.log('[DB] ✅ Connected successfully to MongoDB database (database: grouproute).');

      // Create collections & indexes if needed
      for (const colName of COLLECTION_NAMES) {
        const col = mongoDb.collection(colName);
        if (colName === 'users') {
          await col.createIndex({ email: 1 }, { unique: true, sparse: true }).catch(() => {});
        } else if (colName === 'groups') {
          await col.createIndex({ invite_code: 1 }, { unique: true, sparse: true }).catch(() => {});
        } else if (colName === 'group_members') {
          await col.createIndex({ group_id: 1, user_id: 1 }).catch(() => {});
        } else if (colName === 'trips') {
          await col.createIndex({ group_id: 1 }).catch(() => {});
        } else if (colName === 'trip_events') {
          await col.createIndex({ trip_id: 1, created_at: -1 }).catch(() => {});
        }
      }

      // Hydrate local cache from MongoDB
      localDbCache = { ...initialLocalDb };
      for (const colName of COLLECTION_NAMES) {
        const docs = await mongoDb.collection(colName).find({}).toArray();
        localDbCache[colName] = docs.map(doc => {
          const { _id, ...rest } = doc;
          return { id: rest.id || _id.toString(), ...rest };
        });
      }

      // If MongoDB was empty but local file had data, seed MongoDB from localDb
      const userCount = localDbCache.users.length;
      if (userCount === 0) {
        const existingLocal = loadLocalDb();
        let seededAny = false;
        for (const colName of COLLECTION_NAMES) {
          const localItems = existingLocal[colName] || [];
          if (localItems.length > 0) {
            await mongoDb.collection(colName).insertMany(localItems.map(item => ({ ...item }))).catch(() => {});
            localDbCache[colName] = [...localItems];
            seededAny = true;
          }
        }
        if (seededAny) {
          console.log('[DB] Synchronized initial local records into MongoDB.');
        }
      }

    } catch (err) {
      console.warn(`[DB] ⚠️ MongoDB connection failed (${err.message}). Activating robust local data store fallback.`);
      isMongoConnected = false;
      loadLocalDb();
      console.log('[DB] Local embedded storage engine active & initialized.');
    }
  } else {
    loadLocalDb();
    console.log('[DB] Local embedded storage engine active & initialized.');
  }

  // ---------------------------------------------------------
  // ENSURE DEMO USERS EXIST (Rahul and Aman)
  // ---------------------------------------------------------
  const demoUsers = [
    { email: 'rahul@example.com', name: 'Rahul' },
    { email: 'aman@example.com', name: 'Aman' }
  ];
  const demoHash = '$2a$10$Gr9SVdJpBMkGJdgmv6/7e.NNfZaS/BuVmO9vGIElCwp6ybjyrA4kW'; // 'password123'
  
  let patchedDemos = false;
  for (const demo of demoUsers) {
    let u = localDbCache.users.find(x => x.email.toLowerCase() === demo.email);
    if (!u) {
      u = {
        id: uuidv4(),
        name: demo.name,
        email: demo.email,
        password_hash: demoHash,
        profile_image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${demo.name}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
        created_at: new Date().toISOString()
      };
      localDbCache.users.push(u);
      if (isMongoConnected && mongoDb) {
        await mongoDb.collection('users').insertOne({ ...u }).catch(() => {});
      }
      patchedDemos = true;
    } else if (u.password_hash !== demoHash) {
      u.password_hash = demoHash;
      if (isMongoConnected && mongoDb) {
        await mongoDb.collection('users').updateOne({ id: u.id }, { $set: { password_hash: demoHash } }).catch(() => {});
      }
      patchedDemos = true;
    }
  }

  if (patchedDemos) {
    saveLocalDb();
  }
}

// Database helper object
export const db = {
  isMongo: () => isMongoConnected,
  getMongoDb: () => mongoDb,
  getMongoClient: () => mongoClient,

  // Direct table/collection helpers for unified sync access
  tables: {
    get: (tableName) => {
      const dbData = loadLocalDb();
      return dbData[tableName] || [];
    },

    insert: (tableName, record) => {
      const dbData = loadLocalDb();
      if (!dbData[tableName]) dbData[tableName] = [];
      const newRecord = {
        id: record.id || uuidv4(),
        created_at: record.created_at || new Date().toISOString(),
        ...record
      };

      dbData[tableName].push(newRecord);
      saveLocalDb();

      // Async write to MongoDB
      if (isMongoConnected && mongoDb) {
        mongoDb.collection(tableName).insertOne({ ...newRecord }).catch(err => {
          console.error(`[DB] MongoDB insert error in ${tableName}:`, err.message);
        });
      }

      return newRecord;
    },

    update: (tableName, filterFn, updateValues) => {
      const dbData = loadLocalDb();
      if (!dbData[tableName]) return null;
      const index = dbData[tableName].findIndex(filterFn);
      if (index !== -1) {
        const existing = dbData[tableName][index];
        const updated = {
          ...existing,
          ...updateValues,
          updated_at: new Date().toISOString()
        };
        dbData[tableName][index] = updated;
        saveLocalDb();

        // Async update in MongoDB
        if (isMongoConnected && mongoDb) {
          mongoDb.collection(tableName).updateOne(
            { id: existing.id },
            { $set: { ...updateValues, updated_at: updated.updated_at } }
          ).catch(err => {
            console.error(`[DB] MongoDB update error in ${tableName}:`, err.message);
          });
        }

        return updated;
      }
      return null;
    },

    delete: (tableName, filterFn) => {
      const dbData = loadLocalDb();
      if (!dbData[tableName]) return false;
      const toDelete = dbData[tableName].filter(filterFn);
      const initialLen = dbData[tableName].length;
      dbData[tableName] = dbData[tableName].filter(item => !filterFn(item));
      saveLocalDb();

      // Async delete from MongoDB
      if (isMongoConnected && mongoDb && toDelete.length > 0) {
        const ids = toDelete.map(d => d.id);
        mongoDb.collection(tableName).deleteMany({ id: { $in: ids } }).catch(err => {
          console.error(`[DB] MongoDB delete error in ${tableName}:`, err.message);
        });
      }

      return dbData[tableName].length < initialLen;
    }
  }
};

export default db;
