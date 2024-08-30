const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const dbName = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}`;
    this.client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.client.connect();
    this.db = this.client.db(dbName);
    this.db.createCollection('users');
    this.db.createCollection('files');
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const numberOfUsers = await this.db.collection('users').countDocuments();
    return numberOfUsers;
  }

  async nbFiles() {
    const numberOfFiles = await this.db.collection('files').countDocuments();
    return numberOfFiles;
  }

  async getCollection(collection) {
    return this.db.collection(collection);
  }
}

const dbClient = new DBClient();
export default dbClient;
